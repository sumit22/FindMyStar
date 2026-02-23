use std::f64::consts::PI;

/// Clamps a value to the range [min, max].
pub fn clamp(value: f64, min: f64, max: f64) -> f64 {
    if value < min {
        min
    } else if value > max {
        max
    } else {
        value
    }
}

/// Normalizes an angle in degrees to the range [0, 360).
pub fn normalize_degrees(deg: f64) -> f64 {
    let mut result = deg % 360.0;
    if result < 0.0 {
        result += 360.0;
    }
    result
}

/// Normalizes a time value in hours to the range [0, 24).
pub fn normalize_hours(hours: f64) -> f64 {
    let mut result = hours % 24.0;
    if result < 0.0 {
        result += 24.0;
    }
    result
}

/// Converts degrees to radians.
pub fn deg_to_rad(deg: f64) -> f64 {
    deg * PI / 180.0
}

/// Converts radians to degrees.
pub fn rad_to_deg(rad: f64) -> f64 {
    rad * 180.0 / PI
}

/// Safe arcsine that clamps input to [-1, 1] to prevent NaN.
pub fn safe_asin(x: f64) -> f64 {
    clamp(x, -1.0, 1.0).asin()
}

/// Safe arccosine that clamps input to [-1, 1] to prevent NaN.
pub fn safe_acos(x: f64) -> f64 {
    clamp(x, -1.0, 1.0).acos()
}

/// Computes the angular distance in degrees between two unit vectors.
///
/// Uses clamped acos(dot) to prevent NaN from floating-point drift.
pub fn angular_distance(v1: &super::Vector3, v2: &super::Vector3) -> f64 {
    let dot = v1.dot(v2);
    safe_acos(dot).to_degrees()
}

/// Computes the guidance direction and angular distance from device
/// orientation to a target position.
///
/// Returns (direction_angle_deg, angular_distance_deg) where direction
/// is 0=up, 90=right, 180=down, 270=left on the AR screen.
pub fn compute_direction(
    v_target: &super::Vector3,
    q_device: &super::Quaternion,
) -> (f64, f64) {
    // Transform target into device's local frame
    let q_inv = q_device.conjugate();
    let v_rel = q_inv.rotate_vector(v_target);

    // Direction angle: 0=up, 90=right
    let direction = v_rel.x.atan2(v_rel.y).to_degrees();
    let direction = normalize_degrees(direction);

    // Angular distance
    let forward = q_device.to_forward();
    let distance = angular_distance(&forward, v_target);

    (direction, distance)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::math::{Quaternion, Vector3};

    const EPSILON: f64 = 1e-10;

    // --- clamp tests ---
    #[test]
    fn test_clamp_within_range() {
        assert!((clamp(0.5, 0.0, 1.0) - 0.5).abs() < EPSILON);
    }

    #[test]
    fn test_clamp_below_min() {
        assert!((clamp(-1.0, 0.0, 1.0) - 0.0).abs() < EPSILON);
    }

    #[test]
    fn test_clamp_above_max() {
        assert!((clamp(2.0, 0.0, 1.0) - 1.0).abs() < EPSILON);
    }

    // --- normalize_degrees tests ---
    #[test]
    fn test_normalize_degrees_positive() {
        assert!((normalize_degrees(90.0) - 90.0).abs() < EPSILON);
    }

    #[test]
    fn test_normalize_degrees_negative() {
        assert!((normalize_degrees(-30.0) - 330.0).abs() < EPSILON);
    }

    #[test]
    fn test_normalize_degrees_over_360() {
        assert!((normalize_degrees(450.0) - 90.0).abs() < EPSILON);
    }

    #[test]
    fn test_normalize_degrees_large_negative() {
        assert!((normalize_degrees(-720.0) - 0.0).abs() < EPSILON);
    }

    // --- normalize_hours tests ---
    #[test]
    fn test_normalize_hours_positive() {
        assert!((normalize_hours(12.0) - 12.0).abs() < EPSILON);
    }

    #[test]
    fn test_normalize_hours_negative() {
        assert!((normalize_hours(-3.0) - 21.0).abs() < EPSILON);
    }

    #[test]
    fn test_normalize_hours_over_24() {
        assert!((normalize_hours(25.5) - 1.5).abs() < EPSILON);
    }

    // --- deg/rad conversion tests ---
    #[test]
    fn test_deg_to_rad() {
        assert!((deg_to_rad(180.0) - PI).abs() < EPSILON);
    }

    #[test]
    fn test_rad_to_deg() {
        assert!((rad_to_deg(PI) - 180.0).abs() < EPSILON);
    }

    #[test]
    fn test_deg_rad_round_trip() {
        let original = 42.5;
        let round_trip = rad_to_deg(deg_to_rad(original));
        assert!((round_trip - original).abs() < EPSILON);
    }

    // --- safe_asin / safe_acos tests ---
    #[test]
    fn test_safe_asin_in_range() {
        assert!((safe_asin(0.5) - (0.5_f64).asin()).abs() < EPSILON);
    }

    #[test]
    fn test_safe_asin_out_of_range() {
        let result = safe_asin(1.0000001);
        assert!(!result.is_nan());
        assert!((result - std::f64::consts::FRAC_PI_2).abs() < EPSILON);
    }

    #[test]
    fn test_safe_acos_out_of_range() {
        let result = safe_acos(-1.0000001);
        assert!(!result.is_nan());
        assert!((result - PI).abs() < EPSILON);
    }

    // --- angular_distance tests ---
    #[test]
    fn test_angular_distance_identical() {
        let v = Vector3::new(1.0, 0.0, 0.0);
        assert!(angular_distance(&v, &v).abs() < EPSILON);
    }

    #[test]
    fn test_angular_distance_opposite() {
        let v1 = Vector3::new(1.0, 0.0, 0.0);
        let v2 = Vector3::new(-1.0, 0.0, 0.0);
        assert!((angular_distance(&v1, &v2) - 180.0).abs() < EPSILON);
    }

    #[test]
    fn test_angular_distance_perpendicular() {
        let v1 = Vector3::new(1.0, 0.0, 0.0);
        let v2 = Vector3::new(0.0, 1.0, 0.0);
        assert!((angular_distance(&v1, &v2) - 90.0).abs() < EPSILON);
    }

    #[test]
    fn test_angular_distance_no_nan() {
        // Near-parallel vectors that might produce dot > 1.0 due to fp error
        let v1 = Vector3::new(1.0, 0.0, 0.0);
        let v2 = Vector3::new(1.0, 1e-16, 0.0).normalize();
        let dist = angular_distance(&v1, &v2);
        assert!(!dist.is_nan());
    }

    // --- compute_direction tests ---
    #[test]
    fn test_compute_direction_target_ahead() {
        // Device pointing at target -> distance should be ~0
        let target = Vector3::new(0.0, 0.0, -1.0).normalize();
        let device = Quaternion::identity();
        let (_, distance) = compute_direction(&target, &device);
        assert!(distance < 1.0, "Distance should be near zero when pointing at target");
    }

    #[test]
    fn test_compute_direction_returns_valid_angle() {
        let target = Vector3::new(1.0, 0.0, 0.0).normalize();
        let device = Quaternion::identity();
        let (direction, _) = compute_direction(&target, &device);
        assert!(direction >= 0.0 && direction < 360.0);
    }
}
