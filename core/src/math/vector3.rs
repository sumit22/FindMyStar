use std::ops::{Add, Mul, Neg, Sub};

/// 3D vector in the East-Up-North (EUN) coordinate frame.
///
/// Used for representing directions to celestial objects and device
/// orientation vectors. All guidance computations use unit vectors.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Vector3 {
    pub x: f64, // East component
    pub y: f64, // Up component
    pub z: f64, // North component
}

impl Vector3 {
    /// Creates a new Vector3.
    pub fn new(x: f64, y: f64, z: f64) -> Self {
        Self { x, y, z }
    }

    /// Returns the magnitude (length) of the vector.
    pub fn magnitude(&self) -> f64 {
        (self.x * self.x + self.y * self.y + self.z * self.z).sqrt()
    }

    /// Returns a unit vector in the same direction.
    ///
    /// If the vector is near-zero (magnitude < 1e-15), returns the
    /// arbitrary unit vector [0, 0, 1] (North) to avoid NaN.
    pub fn normalize(&self) -> Vector3 {
        let mag = self.magnitude();
        if mag < 1e-15 {
            return Vector3 {
                x: 0.0,
                y: 0.0,
                z: 1.0,
            };
        }
        Vector3 {
            x: self.x / mag,
            y: self.y / mag,
            z: self.z / mag,
        }
    }

    /// Computes the dot product (scalar projection) of two vectors.
    ///
    /// For unit vectors, equals the cosine of the angle between them.
    pub fn dot(&self, other: &Vector3) -> f64 {
        self.x * other.x + self.y * other.y + self.z * other.z
    }

    /// Computes the cross product, returning a vector perpendicular to both inputs.
    pub fn cross(&self, other: &Vector3) -> Vector3 {
        Vector3 {
            x: self.y * other.z - self.z * other.y,
            y: self.z * other.x - self.x * other.z,
            z: self.x * other.y - self.y * other.x,
        }
    }
}

impl Add for Vector3 {
    type Output = Vector3;
    fn add(self, rhs: Vector3) -> Vector3 {
        Vector3 {
            x: self.x + rhs.x,
            y: self.y + rhs.y,
            z: self.z + rhs.z,
        }
    }
}

impl Sub for Vector3 {
    type Output = Vector3;
    fn sub(self, rhs: Vector3) -> Vector3 {
        Vector3 {
            x: self.x - rhs.x,
            y: self.y - rhs.y,
            z: self.z - rhs.z,
        }
    }
}

impl Mul<f64> for Vector3 {
    type Output = Vector3;
    fn mul(self, scalar: f64) -> Vector3 {
        Vector3 {
            x: self.x * scalar,
            y: self.y * scalar,
            z: self.z * scalar,
        }
    }
}

impl Neg for Vector3 {
    type Output = Vector3;
    fn neg(self) -> Vector3 {
        Vector3 {
            x: -self.x,
            y: -self.y,
            z: -self.z,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const EPSILON: f64 = 1e-12;

    #[test]
    fn test_magnitude() {
        let v = Vector3::new(3.0, 4.0, 0.0);
        assert!((v.magnitude() - 5.0).abs() < EPSILON);
    }

    #[test]
    fn test_magnitude_unit_vector() {
        let v = Vector3::new(1.0, 0.0, 0.0);
        assert!((v.magnitude() - 1.0).abs() < EPSILON);
    }

    #[test]
    fn test_normalize() {
        let v = Vector3::new(3.0, 0.0, 4.0);
        let n = v.normalize();
        assert!((n.magnitude() - 1.0).abs() < EPSILON);
        assert!((n.x - 0.6).abs() < EPSILON);
        assert!((n.z - 0.8).abs() < EPSILON);
    }

    #[test]
    fn test_normalize_zero_vector() {
        let v = Vector3::new(0.0, 0.0, 0.0);
        let n = v.normalize();
        assert_eq!(n, Vector3::new(0.0, 0.0, 1.0));
    }

    #[test]
    fn test_normalize_near_zero() {
        let v = Vector3::new(1e-20, 0.0, 0.0);
        let n = v.normalize();
        assert_eq!(n, Vector3::new(0.0, 0.0, 1.0));
    }

    #[test]
    fn test_normalize_preserves_magnitude() {
        let v = Vector3::new(7.5, -2.3, 4.1);
        let n = v.normalize();
        assert!((n.magnitude() - 1.0).abs() < EPSILON);
    }

    #[test]
    fn test_dot_orthogonal() {
        let a = Vector3::new(1.0, 0.0, 0.0);
        let b = Vector3::new(0.0, 1.0, 0.0);
        assert!(a.dot(&b).abs() < EPSILON);
    }

    #[test]
    fn test_dot_parallel() {
        let a = Vector3::new(1.0, 0.0, 0.0);
        let b = Vector3::new(2.0, 0.0, 0.0);
        assert!((a.dot(&b) - 2.0).abs() < EPSILON);
    }

    #[test]
    fn test_dot_antiparallel() {
        let a = Vector3::new(1.0, 0.0, 0.0);
        let b = Vector3::new(-1.0, 0.0, 0.0);
        assert!((a.dot(&b) - (-1.0)).abs() < EPSILON);
    }

    #[test]
    fn test_cross_perpendicularity() {
        let a = Vector3::new(1.0, 0.0, 0.0);
        let b = Vector3::new(0.0, 1.0, 0.0);
        let c = a.cross(&b);
        // Cross product should be perpendicular to both inputs
        assert!(c.dot(&a).abs() < EPSILON);
        assert!(c.dot(&b).abs() < EPSILON);
        // x cross y = z
        assert!((c.z - 1.0).abs() < EPSILON);
    }

    #[test]
    fn test_cross_anticommutative() {
        let a = Vector3::new(1.0, 2.0, 3.0);
        let b = Vector3::new(4.0, 5.0, 6.0);
        let ab = a.cross(&b);
        let ba = b.cross(&a);
        assert!((ab.x + ba.x).abs() < EPSILON);
        assert!((ab.y + ba.y).abs() < EPSILON);
        assert!((ab.z + ba.z).abs() < EPSILON);
    }

    #[test]
    fn test_add() {
        let a = Vector3::new(1.0, 2.0, 3.0);
        let b = Vector3::new(4.0, 5.0, 6.0);
        let c = a + b;
        assert!((c.x - 5.0).abs() < EPSILON);
        assert!((c.y - 7.0).abs() < EPSILON);
        assert!((c.z - 9.0).abs() < EPSILON);
    }

    #[test]
    fn test_sub() {
        let a = Vector3::new(4.0, 5.0, 6.0);
        let b = Vector3::new(1.0, 2.0, 3.0);
        let c = a - b;
        assert!((c.x - 3.0).abs() < EPSILON);
        assert!((c.y - 3.0).abs() < EPSILON);
        assert!((c.z - 3.0).abs() < EPSILON);
    }

    #[test]
    fn test_scalar_mul() {
        let v = Vector3::new(1.0, 2.0, 3.0);
        let s = v * 2.0;
        assert!((s.x - 2.0).abs() < EPSILON);
        assert!((s.y - 4.0).abs() < EPSILON);
        assert!((s.z - 6.0).abs() < EPSILON);
    }

    #[test]
    fn test_neg() {
        let v = Vector3::new(1.0, -2.0, 3.0);
        let n = -v;
        assert!((n.x - (-1.0)).abs() < EPSILON);
        assert!((n.y - 2.0).abs() < EPSILON);
        assert!((n.z - (-3.0)).abs() < EPSILON);
    }
}
