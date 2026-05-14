//! Build script — injects the 32-byte entitlement HMAC signing key into the
//! compiled binary without it appearing in checked-in source.
//!
//! Key source priority:
//!   1. `FINDMYSTAR_ENTITLEMENT_KEY` env var (64 hex chars). Used by CI.
//!   2. `core/entitlement_key.local` file (64 hex chars on first line, gitignored).
//!      Used for local dev/release builds.
//!   3. Zero bytes (32 × 0x00). Used by fresh clones with no setup. Builds
//!      still compile and tests still pass — entitlement blobs signed with a
//!      different key just won't verify.
//!
//! The generated `entitlement_key.rs` is written to `OUT_DIR` and included
//! by `src/entitlement.rs` via `include!(concat!(env!("OUT_DIR"), ...))`.

use std::env;
use std::fs;
use std::path::{Path, PathBuf};

fn main() {
    println!("cargo:rerun-if-env-changed=FINDMYSTAR_ENTITLEMENT_KEY");

    let local_key_path: PathBuf =
        Path::new(env!("CARGO_MANIFEST_DIR")).join("entitlement_key.local");
    println!("cargo:rerun-if-changed={}", local_key_path.display());

    let key = load_key(&local_key_path);

    let out_dir = env::var("OUT_DIR").expect("OUT_DIR not set by cargo");
    let dest = Path::new(&out_dir).join("entitlement_key.rs");

    let mut body = String::from("pub(super) const SIGNING_KEY: [u8; 32] = [");
    for (i, b) in key.iter().enumerate() {
        if i > 0 {
            body.push_str(", ");
        }
        body.push_str(&format!("0x{:02x}", b));
    }
    body.push_str("];\n");

    fs::write(&dest, body).expect("failed to write entitlement_key.rs");
}

fn load_key(local_path: &Path) -> [u8; 32] {
    if let Ok(hex) = env::var("FINDMYSTAR_ENTITLEMENT_KEY") {
        return parse_hex_32(hex.trim())
            .expect("FINDMYSTAR_ENTITLEMENT_KEY must be 64 hex characters (32 bytes)");
    }

    if let Ok(contents) = fs::read_to_string(local_path) {
        let first_line = contents.lines().next().unwrap_or("").trim();
        if !first_line.is_empty() {
            return parse_hex_32(first_line).unwrap_or_else(|| {
                panic!(
                    "{} must contain 64 hex characters on the first line",
                    local_path.display()
                )
            });
        }
    }

    println!(
        "cargo:warning=No entitlement signing key found (neither FINDMYSTAR_ENTITLEMENT_KEY \
         env var nor core/entitlement_key.local file). Using zero key — fine for dev, but \
         release builds will not verify entitlements signed with the production key."
    );
    [0u8; 32]
}

fn parse_hex_32(s: &str) -> Option<[u8; 32]> {
    if s.len() != 64 {
        return None;
    }
    let mut out = [0u8; 32];
    for i in 0..32 {
        out[i] = u8::from_str_radix(&s[i * 2..i * 2 + 2], 16).ok()?;
    }
    Some(out)
}
