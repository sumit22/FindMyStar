use super::vector3::Vector3;

/// Unit quaternion representing a 3D rotation.
///
/// Quaternions avoid gimbal lock and provide smooth interpolation,
/// making them ideal for representing device orientation from IMU sensors.
/// A valid unit quaternion satisfies w² + x² + y² + z² = 1.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Quaternion {
    pub w: f64, // Scalar (real) part
    pub x: f64, // i component
    pub y: f64, // j component
    pub z: f64, // k component
}

impl Quaternion {
    /// Creates a new Quaternion.
    pub fn new(w: f64, x: f64, y: f64, z: f64) -> Self {
        Self { w, x, y, z }
    }

    /// Returns the identity quaternion (no rotation).
    pub fn identity() -> Self {
        Self {
            w: 1.0,
            x: 0.0,
            y: 0.0,
            z: 0.0,
        }
    }

    /// Computes the Hamilton product of two quaternions.
    ///
    /// If Q1 represents rotation A and Q2 represents rotation B,
    /// then Q1 * Q2 represents "apply B first, then A."
    /// Quaternion multiplication is NOT commutative.
    pub fn multiply(&self, other: &Quaternion) -> Quaternion {
        Quaternion {
            w: self.w * other.w - self.x * other.x - self.y * other.y - self.z * other.z,
            x: self.w * other.x + self.x * other.w + self.y * other.z - self.z * other.y,
            y: self.w * other.y - self.x * other.z + self.y * other.w + self.z * other.x,
            z: self.w * other.z + self.x * other.y - self.y * other.x + self.z * other.w,
        }
    }

    /// Returns the conjugate (inverse for unit quaternions).
    ///
    /// If Q rotates from frame A to B, then Q* rotates from B to A.
    pub fn conjugate(&self) -> Quaternion {
        Quaternion {
            w: self.w,
            x: -self.x,
            y: -self.y,
            z: -self.z,
        }
    }

    /// Normalizes the quaternion to unit length.
    ///
    /// Corrects floating-point drift after repeated multiplications.
    pub fn normalize(&self) -> Quaternion {
        let mag =
            (self.w * self.w + self.x * self.x + self.y * self.y + self.z * self.z).sqrt();
        if mag < 1e-15 {
            return Quaternion::identity();
        }
        Quaternion {
            w: self.w / mag,
            x: self.x / mag,
            y: self.y / mag,
            z: self.z / mag,
        }
    }

    /// Rotates a vector by this quaternion: v' = Q * v_quat * Q*
    pub fn rotate_vector(&self, v: &Vector3) -> Vector3 {
        let v_quat = Quaternion {
            w: 0.0,
            x: v.x,
            y: v.y,
            z: v.z,
        };
        let result = self.multiply(&v_quat).multiply(&self.conjugate());
        Vector3 {
            x: result.x,
            y: result.y,
            z: result.z,
        }
    }

    /// Extracts the forward direction vector from the quaternion.
    ///
    /// Rotates the reference direction [0, 0, -1] (camera into screen)
    /// by this quaternion to get the direction the device is pointing.
    pub fn to_forward(&self) -> Vector3 {
        self.rotate_vector(&Vector3::new(0.0, 0.0, -1.0))
            .normalize()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const EPSILON: f64 = 1e-10;

    #[test]
    fn test_identity_rotation() {
        let q = Quaternion::identity();
        let v = Vector3::new(1.0, 2.0, 3.0);
        let rotated = q.rotate_vector(&v);
        assert!((rotated.x - v.x).abs() < EPSILON);
        assert!((rotated.y - v.y).abs() < EPSILON);
        assert!((rotated.z - v.z).abs() < EPSILON);
    }

    #[test]
    fn test_rotation_preserves_magnitude() {
        // 90 degrees around Z axis: Q = (cos(45°), 0, 0, sin(45°))
        let angle = std::f64::consts::FRAC_PI_4;
        let q = Quaternion::new(angle.cos(), 0.0, 0.0, angle.sin());
        let v = Vector3::new(1.0, 2.0, 3.0);
        let rotated = q.rotate_vector(&v);
        assert!((rotated.magnitude() - v.magnitude()).abs() < EPSILON);
    }

    #[test]
    fn test_90_deg_rotation_around_z() {
        // 90° around Z: (1,0,0) -> (0,1,0) in standard coords
        // Q for 90° around Z = (cos(45°), 0, 0, sin(45°))
        let half_angle = std::f64::consts::FRAC_PI_4;
        let q = Quaternion::new(half_angle.cos(), 0.0, 0.0, half_angle.sin());
        let v = Vector3::new(1.0, 0.0, 0.0);
        let rotated = q.rotate_vector(&v);
        assert!((rotated.x - 0.0).abs() < EPSILON);
        assert!((rotated.y - 1.0).abs() < EPSILON);
        assert!((rotated.z - 0.0).abs() < EPSILON);
    }

    #[test]
    fn test_90_deg_rotation_around_x() {
        // 90° around X: (0,1,0) -> (0,0,1)
        let half_angle = std::f64::consts::FRAC_PI_4;
        let q = Quaternion::new(half_angle.cos(), half_angle.sin(), 0.0, 0.0);
        let v = Vector3::new(0.0, 1.0, 0.0);
        let rotated = q.rotate_vector(&v);
        assert!((rotated.x - 0.0).abs() < EPSILON);
        assert!((rotated.y - 0.0).abs() < EPSILON);
        assert!((rotated.z - 1.0).abs() < EPSILON);
    }

    #[test]
    fn test_90_deg_rotation_around_y() {
        // 90° around Y: (0,0,1) -> (1,0,0)
        let half_angle = std::f64::consts::FRAC_PI_4;
        let q = Quaternion::new(half_angle.cos(), 0.0, half_angle.sin(), 0.0);
        let v = Vector3::new(0.0, 0.0, 1.0);
        let rotated = q.rotate_vector(&v);
        assert!((rotated.x - 1.0).abs() < EPSILON);
        assert!((rotated.y - 0.0).abs() < EPSILON);
        assert!((rotated.z - 0.0).abs() < EPSILON);
    }

    #[test]
    fn test_multiply_non_commutative() {
        let q1 = Quaternion::new(0.7071, 0.7071, 0.0, 0.0);
        let q2 = Quaternion::new(0.7071, 0.0, 0.7071, 0.0);
        let q1q2 = q1.multiply(&q2);
        let q2q1 = q2.multiply(&q1);
        // They should NOT be equal
        let diff = (q1q2.w - q2q1.w).abs()
            + (q1q2.x - q2q1.x).abs()
            + (q1q2.y - q2q1.y).abs()
            + (q1q2.z - q2q1.z).abs();
        assert!(diff > 0.01, "Quaternion multiplication should not be commutative");
    }

    #[test]
    fn test_conjugate() {
        let q = Quaternion::new(0.5, 0.5, 0.5, 0.5);
        let c = q.conjugate();
        assert!((c.w - 0.5).abs() < EPSILON);
        assert!((c.x - (-0.5)).abs() < EPSILON);
        assert!((c.y - (-0.5)).abs() < EPSILON);
        assert!((c.z - (-0.5)).abs() < EPSILON);
    }

    #[test]
    fn test_normalize() {
        let q = Quaternion::new(2.0, 0.0, 0.0, 0.0);
        let n = q.normalize();
        let mag = (n.w * n.w + n.x * n.x + n.y * n.y + n.z * n.z).sqrt();
        assert!((mag - 1.0).abs() < EPSILON);
    }

    #[test]
    fn test_conjugate_undoes_rotation() {
        let half_angle = 0.3;
        let q = Quaternion::new(half_angle.cos(), half_angle.sin(), 0.0, 0.0);
        let v = Vector3::new(1.0, 2.0, 3.0);
        let rotated = q.rotate_vector(&v);
        let restored = q.conjugate().rotate_vector(&rotated);
        assert!((restored.x - v.x).abs() < EPSILON);
        assert!((restored.y - v.y).abs() < EPSILON);
        assert!((restored.z - v.z).abs() < EPSILON);
    }

    #[test]
    fn test_to_forward_identity() {
        let q = Quaternion::identity();
        let fwd = q.to_forward();
        // Identity should give [0, 0, -1]
        assert!((fwd.x - 0.0).abs() < EPSILON);
        assert!((fwd.y - 0.0).abs() < EPSILON);
        assert!((fwd.z - (-1.0)).abs() < EPSILON);
    }
}
