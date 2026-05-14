/// Entitlement module — capability-based pro gating with HMAC-signed payloads.
///
/// Wire format (57 bytes):
///   [plan_type:1][valid_until_ms:8 LE][device_hash:16][hmac_sha256:32]
///
/// The device_hash binds the entitlement to a specific device, preventing
/// blob-copy attacks. The HMAC covers all 25 payload bytes.
///
/// The HMAC prevents trivial SQLite tampering. The Rust engine always verifies
/// the signature and checks expiration before granting pro access.
///
/// The 32-byte signing key is injected at build time by `build.rs` from either
/// the `FINDMYSTAR_ENTITLEMENT_KEY` env var or `core/entitlement_key.local`
/// (gitignored). Builds with no key configured fall back to all-zero bytes —
/// fine for dev, but won't verify against production-signed entitlements.
use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};

type HmacSha256 = Hmac<Sha256>;

include!(concat!(env!("OUT_DIR"), "/entitlement_key.rs"));

/// Total serialized size of an entitlement payload.
pub const ENTITLEMENT_SIZE: usize = 57; // 1 + 8 + 16 + 32

/// Payload size before HMAC (plan_type + valid_until_ms + device_hash).
const PAYLOAD_SIZE: usize = 25; // 1 + 8 + 16

/// Offset where the device hash starts within the buffer.
const DEVICE_HASH_OFFSET: usize = 9; // after plan(1) + valid_until(8)

/// Size of the truncated device fingerprint hash.
pub const DEVICE_HASH_SIZE: usize = 16;

/// Plan type — determines entitlement behavior.
#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PlanType {
    Free = 0,
    Lifetime = 1,
    Subscription = 2,
}

impl PlanType {
    fn from_u8(v: u8) -> Option<Self> {
        match v {
            0 => Some(PlanType::Free),
            1 => Some(PlanType::Lifetime),
            2 => Some(PlanType::Subscription),
            _ => None,
        }
    }
}

/// Deserialized entitlement with verified signature.
#[derive(Debug, Clone)]
pub struct Entitlement {
    pub plan: PlanType,
    /// Unix milliseconds. 0 means no expiry (lifetime).
    pub valid_until_ms: u64,
    /// Truncated SHA-256 of the device fingerprint (first 16 bytes).
    pub device_hash: [u8; DEVICE_HASH_SIZE],
}

/// Hashes a device fingerprint string into a 16-byte truncated SHA-256.
///
/// The platform layer provides this string (e.g., Android's `Settings.Secure.ANDROID_ID`
/// or iOS `identifierForVendor`). We hash it so the raw identifier never appears in storage.
pub fn hash_device_id(device_id: &[u8]) -> [u8; DEVICE_HASH_SIZE] {
    let full = Sha256::digest(device_id);
    let mut out = [0u8; DEVICE_HASH_SIZE];
    out.copy_from_slice(&full[..DEVICE_HASH_SIZE]);
    out
}

/// Creates a signed entitlement blob (57 bytes).
///
/// `device_hash` is a 16-byte truncated SHA-256 of the device fingerprint,
/// obtained via `hash_device_id()`.
///
/// Returns `None` if `plan_type` is invalid.
pub fn create_entitlement(
    plan_type: u8,
    valid_until_ms: u64,
    device_hash: &[u8; DEVICE_HASH_SIZE],
) -> Option<[u8; ENTITLEMENT_SIZE]> {
    // Validate plan type
    PlanType::from_u8(plan_type)?;

    let mut buf = [0u8; ENTITLEMENT_SIZE];

    // Serialize payload: [plan:1][valid_until_ms:8 LE][device_hash:16]
    buf[0] = plan_type;
    buf[1..9].copy_from_slice(&valid_until_ms.to_le_bytes());
    buf[DEVICE_HASH_OFFSET..DEVICE_HASH_OFFSET + DEVICE_HASH_SIZE].copy_from_slice(device_hash);

    // Compute HMAC-SHA256 over the 25-byte payload
    let mut mac = HmacSha256::new_from_slice(&SIGNING_KEY).expect("key length is always valid");
    mac.update(&buf[..PAYLOAD_SIZE]);
    let signature = mac.finalize().into_bytes();
    buf[PAYLOAD_SIZE..].copy_from_slice(&signature);

    Some(buf)
}

/// Verifies the HMAC signature, checks the device hash, and deserializes.
///
/// `expected_device_hash` is the 16-byte hash for the current device.
/// Returns `None` if the buffer is wrong size, signature is invalid,
/// device doesn't match, or plan type is unknown.
pub fn verify_and_decode(
    buf: &[u8],
    expected_device_hash: &[u8; DEVICE_HASH_SIZE],
) -> Option<Entitlement> {
    if buf.len() != ENTITLEMENT_SIZE {
        return None;
    }

    // Verify HMAC first (constant-time comparison inside hmac crate)
    let mut mac = HmacSha256::new_from_slice(&SIGNING_KEY).expect("key length is always valid");
    mac.update(&buf[..PAYLOAD_SIZE]);
    mac.verify_slice(&buf[PAYLOAD_SIZE..]).ok()?;

    // Deserialize
    let plan = PlanType::from_u8(buf[0])?;
    let valid_until_ms = u64::from_le_bytes(buf[1..9].try_into().ok()?);

    let mut device_hash = [0u8; DEVICE_HASH_SIZE];
    device_hash.copy_from_slice(&buf[DEVICE_HASH_OFFSET..DEVICE_HASH_OFFSET + DEVICE_HASH_SIZE]);

    // Verify device binding
    if device_hash != *expected_device_hash {
        return None;
    }

    Some(Entitlement {
        plan,
        valid_until_ms,
        device_hash,
    })
}

/// Checks whether the entitlement grants pro access at the given time.
///
/// Always checks expiration — even Lifetime plans go through the same path.
/// - Free → false
/// - Lifetime → true if `valid_until_ms == 0` (no expiry) or `now_ms < valid_until_ms`
/// - Subscription → true if `now_ms < valid_until_ms`
pub fn is_pro(ent: &Entitlement, now_ms: u64) -> bool {
    match ent.plan {
        PlanType::Free => false,
        PlanType::Lifetime => ent.valid_until_ms == 0 || now_ms < ent.valid_until_ms,
        PlanType::Subscription => ent.valid_until_ms > 0 && now_ms < ent.valid_until_ms,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_device_hash() -> [u8; DEVICE_HASH_SIZE] {
        hash_device_id(b"test-device-12345")
    }

    fn other_device_hash() -> [u8; DEVICE_HASH_SIZE] {
        hash_device_id(b"other-device-99999")
    }

    #[test]
    fn create_and_verify_lifetime() {
        let dh = test_device_hash();
        let blob = create_entitlement(PlanType::Lifetime as u8, 0, &dh).unwrap();
        assert_eq!(blob.len(), ENTITLEMENT_SIZE);

        let ent = verify_and_decode(&blob, &dh).unwrap();
        assert_eq!(ent.plan, PlanType::Lifetime);
        assert_eq!(ent.valid_until_ms, 0);
        assert!(is_pro(&ent, 1_000_000));
    }

    #[test]
    fn create_and_verify_subscription_active() {
        let dh = test_device_hash();
        let future_ms = 2_000_000_000_000u64;
        let blob = create_entitlement(PlanType::Subscription as u8, future_ms, &dh).unwrap();
        let ent = verify_and_decode(&blob, &dh).unwrap();
        assert_eq!(ent.plan, PlanType::Subscription);
        assert_eq!(ent.valid_until_ms, future_ms);
        assert!(is_pro(&ent, 1_000_000_000_000));
    }

    #[test]
    fn subscription_expired() {
        let dh = test_device_hash();
        let past_ms = 1_000_000u64;
        let blob = create_entitlement(PlanType::Subscription as u8, past_ms, &dh).unwrap();
        let ent = verify_and_decode(&blob, &dh).unwrap();
        assert!(!is_pro(&ent, 2_000_000));
    }

    #[test]
    fn free_plan_not_pro() {
        let dh = test_device_hash();
        let blob = create_entitlement(PlanType::Free as u8, 0, &dh).unwrap();
        let ent = verify_and_decode(&blob, &dh).unwrap();
        assert!(!is_pro(&ent, 0));
    }

    #[test]
    fn tampered_payload_rejected() {
        let dh = test_device_hash();
        let mut blob = create_entitlement(PlanType::Lifetime as u8, 0, &dh).unwrap();
        blob[0] = PlanType::Subscription as u8;
        assert!(verify_and_decode(&blob, &dh).is_none());
    }

    #[test]
    fn tampered_signature_rejected() {
        let dh = test_device_hash();
        let mut blob = create_entitlement(PlanType::Lifetime as u8, 0, &dh).unwrap();
        blob[PAYLOAD_SIZE] ^= 0xFF;
        assert!(verify_and_decode(&blob, &dh).is_none());
    }

    #[test]
    fn wrong_device_rejected() {
        let dh = test_device_hash();
        let blob = create_entitlement(PlanType::Lifetime as u8, 0, &dh).unwrap();
        // Verify with a different device hash → rejected
        assert!(verify_and_decode(&blob, &other_device_hash()).is_none());
    }

    #[test]
    fn wrong_size_rejected() {
        let dh = test_device_hash();
        assert!(verify_and_decode(&[0u8; 10], &dh).is_none());
        assert!(verify_and_decode(&[], &dh).is_none());
    }

    #[test]
    fn invalid_plan_type_rejected() {
        let dh = test_device_hash();
        assert!(create_entitlement(99, 0, &dh).is_none());
    }

    #[test]
    fn lifetime_with_expiry_still_checked() {
        let dh = test_device_hash();
        let expiry_ms = 5_000_000u64;
        let blob = create_entitlement(PlanType::Lifetime as u8, expiry_ms, &dh).unwrap();
        let ent = verify_and_decode(&blob, &dh).unwrap();
        assert!(is_pro(&ent, 1_000_000));
        assert!(!is_pro(&ent, 10_000_000));
    }

    #[test]
    fn device_hash_deterministic() {
        let h1 = hash_device_id(b"same-device");
        let h2 = hash_device_id(b"same-device");
        assert_eq!(h1, h2);
    }

    #[test]
    fn device_hash_differs_for_different_ids() {
        let h1 = hash_device_id(b"device-a");
        let h2 = hash_device_id(b"device-b");
        assert_ne!(h1, h2);
    }
}
