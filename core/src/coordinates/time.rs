/// Julian Date of Unix epoch (January 1, 1970 00:00:00 UTC).
pub const JD_UNIX_EPOCH: f64 = 2_440_587.5;

/// Julian Date of J2000.0 epoch (January 1, 2000 12:00:00 TT).
pub const JD_J2000: f64 = 2_451_545.0;

/// Milliseconds per day.
const MS_PER_DAY: f64 = 86_400_000.0;

/// Days per Julian century.
const DAYS_PER_CENTURY: f64 = 36_525.0;

/// Converts Unix timestamp in milliseconds to Julian Date.
pub fn unix_to_jd(unix_ms: f64) -> f64 {
    JD_UNIX_EPOCH + unix_ms / MS_PER_DAY
}

/// Converts Julian Date to Unix timestamp in milliseconds.
pub fn jd_to_unix(jd: f64) -> f64 {
    (jd - JD_UNIX_EPOCH) * MS_PER_DAY
}

/// Converts Julian Date to Julian centuries since J2000.0.
pub fn jd_to_centuries(jd: f64) -> f64 {
    (jd - JD_J2000) / DAYS_PER_CENTURY
}

#[cfg(test)]
mod tests {
    use super::*;

    const EPSILON: f64 = 1e-6;

    #[test]
    fn test_unix_epoch_to_jd() {
        assert!((unix_to_jd(0.0) - JD_UNIX_EPOCH).abs() < EPSILON);
    }

    #[test]
    fn test_j2000_epoch() {
        // J2000.0 = January 1, 2000 12:00 TT
        // Unix timestamp for this: 946728000000 ms (approximately)
        let j2000_unix_ms = (JD_J2000 - JD_UNIX_EPOCH) * MS_PER_DAY;
        let jd = unix_to_jd(j2000_unix_ms);
        assert!((jd - JD_J2000).abs() < EPSILON);
    }

    #[test]
    fn test_jd_to_centuries_at_j2000() {
        assert!(jd_to_centuries(JD_J2000).abs() < EPSILON);
    }

    #[test]
    fn test_jd_to_centuries_one_century() {
        let jd = JD_J2000 + DAYS_PER_CENTURY;
        assert!((jd_to_centuries(jd) - 1.0).abs() < EPSILON);
    }

    #[test]
    fn test_round_trip_conversion() {
        let original_ms = 1_700_000_000_000.0; // ~Nov 2023
        let jd = unix_to_jd(original_ms);
        let round_trip = jd_to_unix(jd);
        assert!((round_trip - original_ms).abs() < 1.0); // Within 1ms
    }

    #[test]
    fn test_known_date() {
        // 2024-01-01 00:00:00 UTC = Unix 1704067200000 ms
        // JD should be approximately 2460310.5
        let unix_ms = 1_704_067_200_000.0;
        let jd = unix_to_jd(unix_ms);
        assert!((jd - 2_460_310.5).abs() < 0.001);
    }
}
