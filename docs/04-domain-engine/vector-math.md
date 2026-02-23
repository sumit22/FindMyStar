# Vector Mathematics & Quaternions

## 1. 3D Vector Operations

The `Vector3` struct is the fundamental geometric primitive in the domain engine. It represents directions in the East-Up-North coordinate system and is used for angular distance, guidance computation, and device frame transforms.

### 1.1 Data Structure

```rust
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Vector3 {
    pub x: f64,  // East component
    pub y: f64,  // Up component
    pub z: f64,  // North component
}
```

All vectors used in guidance computations are **unit vectors** (magnitude = 1.0). This is enforced by normalization at creation time.

### 1.2 Core Operations

**Magnitude (length)**:

```rust
impl Vector3 {
    pub fn magnitude(&self) -> f64 {
        (self.x * self.x + self.y * self.y + self.z * self.z).sqrt()
    }
}
```

**Normalization** (scale to unit length):

```rust
impl Vector3 {
    pub fn normalize(&self) -> Vector3 {
        let mag = self.magnitude();
        if mag < 1e-15 {
            // Degenerate: return arbitrary unit vector rather than NaN
            return Vector3 { x: 0.0, y: 0.0, z: 1.0 };
        }
        Vector3 {
            x: self.x / mag,
            y: self.y / mag,
            z: self.z / mag,
        }
    }
}
```

**Dot product** (scalar projection):

```
a . b = a.x * b.x + a.y * b.y + a.z * b.z
```

For unit vectors, the dot product equals the cosine of the angle between them.

```rust
impl Vector3 {
    pub fn dot(&self, other: &Vector3) -> f64 {
        self.x * other.x + self.y * other.y + self.z * other.z
    }
}
```

**Cross product** (perpendicular vector):

```
a x b = (a.y*b.z - a.z*b.y, a.z*b.x - a.x*b.z, a.x*b.y - a.y*b.x)
```

```rust
impl Vector3 {
    pub fn cross(&self, other: &Vector3) -> Vector3 {
        Vector3 {
            x: self.y * other.z - self.z * other.y,
            y: self.z * other.x - self.x * other.z,
            z: self.x * other.y - self.y * other.x,
        }
    }
}
```

The cross product is used internally by the quaternion rotation implementation and is not directly exposed through FFI.

---

## 2. Angular Distance

Angular distance is the primary metric for AR guidance. It measures the angle between the camera's forward vector and the target's direction vector.

### 2.1 Formula

For two unit vectors **v_target** and **v_camera**:

```
angle = acos( clamp(v_target . v_camera, -1.0, 1.0) )
```

The result is in radians, converted to degrees for the UI.

### 2.2 Implementation

```rust
pub fn angular_distance(v1: &Vector3, v2: &Vector3) -> f64 {
    let dot = v1.dot(v2);
    let clamped = dot.clamp(-1.0, 1.0);
    clamped.acos().to_degrees()
}
```

Documented in [algorithms.md, Section 4.1](./algorithms.md#41-angular-error-between-two-unit-vectors).

### 2.3 Clamping Rationale

The dot product of two unit vectors should always lie in [-1, 1]. However, accumulated floating-point error from quaternion rotation and normalization can produce values like 1.0000000000000002. Without clamping, `acos` returns `NaN`, which would propagate through the entire guidance pipeline.

The maximum observed drift in testing is approximately 1e-14, so clamping has no effect on the result's accuracy -- it only prevents domain errors.

### 2.4 Usage in AR Loop

The AR tracking loop uses angular distance to determine the guidance state:

| Angular Distance | State | UI Behavior |
|-----------------|-------|-------------|
| > 30 degrees | Far | Large arrow, compass direction |
| 5-30 degrees | Approaching | Arrow with distance readout |
| 0.5-5 degrees | Close | Pulsing reticle |
| < 0.5 degrees | Locked | "TARGET LOCKED" indicator |

---

## 3. Direction Vector (Thrust Vector)

The direction vector tells the user **which way to move their phone** to align with the target. It transforms the target's position into the camera's local coordinate frame.

### 3.1 Algorithm

Documented in [algorithms.md, Section 4.2](./algorithms.md#42-direction-vector-thrust-vector).

```
Input:
  v_target   3D unit vector pointing at the celestial object (world frame)
  Q_device   Quaternion representing device orientation (world frame)

Output:
  direction  Angle in degrees (0=up, 90=right, 180=down, 270=left)
  distance   Angular separation in degrees

Steps:

1. Transform target into device frame:
   v_rel = Q_device^(-1) * v_target

2. Extract deviations:
   right_deviation = v_rel.x    // positive = move right
   up_deviation    = v_rel.y    // positive = move up

3. Compute guidance angle:
   direction = atan2(right_deviation, up_deviation) * 180 / pi
   direction = direction mod 360

4. Compute distance:
   distance = angular_distance(quaternion_to_forward(Q_device), v_target)
```

### 3.2 Rust Implementation

```rust
pub fn compute_direction(
    v_target: &Vector3,
    q_device: &Quaternion,
) -> (f64, f64) {
    // Transform target into device's local frame
    let q_inv = q_device.conjugate();
    let v_rel = q_inv.rotate_vector(v_target);

    // Direction angle: 0=up, 90=right
    let direction = v_rel.x.atan2(v_rel.y).to_degrees();
    let direction = normalize_degrees(direction);

    // Angular distance
    let forward = quaternion_to_forward(q_device);
    let distance = angular_distance(&forward, v_target);

    (direction, distance)
}
```

### 3.3 Interpretation

The direction angle maps to an arrow on the AR screen:

```
           0° (Up)
           |
  270° ----+---- 90°
  (Left)   |   (Right)
          180° (Down)
```

The UI renders a directional arrow at this angle, scaled by the distance. As the distance approaches zero, the arrow is replaced by the lock indicator.

---

## 4. Quaternion Operations

Quaternions represent 3D rotations without the gimbal-lock problem that plagues Euler angles. The device IMU provides orientation as a quaternion, and all rotation operations in the engine use quaternion algebra.

### 4.1 Data Structure

```rust
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Quaternion {
    pub w: f64,  // Scalar (real) part
    pub x: f64,  // i component
    pub y: f64,  // j component
    pub z: f64,  // k component
}
```

A unit quaternion satisfies `w^2 + x^2 + y^2 + z^2 = 1`.

### 4.2 Multiplication (Hamilton Product)

Quaternion multiplication composes rotations. If `Q1` represents rotation A and `Q2` represents rotation B, then `Q1 * Q2` represents "apply B first, then A."

```
Q_result = Q1 * Q2

w = w1*w2 - x1*x2 - y1*y2 - z1*z2
x = w1*x2 + x1*w2 + y1*z2 - z1*y2
y = w1*y2 - x1*z2 + y1*w2 + z1*x2
z = w1*z2 + x1*y2 - y1*x2 + z1*w2
```

Documented in [algorithms.md, Section 8.2](./algorithms.md#82-quaternion-multiplication).

```rust
impl Quaternion {
    pub fn multiply(&self, other: &Quaternion) -> Quaternion {
        Quaternion {
            w: self.w * other.w - self.x * other.x
             - self.y * other.y - self.z * other.z,
            x: self.w * other.x + self.x * other.w
             + self.y * other.z - self.z * other.y,
            y: self.w * other.y - self.x * other.z
             + self.y * other.w + self.z * other.x,
            z: self.w * other.z + self.x * other.y
             - self.y * other.x + self.z * other.w,
        }
    }
}
```

Quaternion multiplication is **not commutative**: `Q1 * Q2 != Q2 * Q1` in general.

### 4.3 Conjugate and Inverse

For a **unit quaternion**, the conjugate equals the inverse:

```
Q* = (w, -x, -y, -z)
Q^(-1) = Q* / |Q|^2 = Q*    (when |Q| = 1)
```

```rust
impl Quaternion {
    pub fn conjugate(&self) -> Quaternion {
        Quaternion {
            w: self.w,
            x: -self.x,
            y: -self.y,
            z: -self.z,
        }
    }
}
```

The conjugate represents the **inverse rotation**. If `Q` rotates from frame A to frame B, then `Q*` rotates from frame B to frame A.

### 4.4 Rotating a Vector

To rotate vector **v** by quaternion **Q**:

```
v' = Q * v_quat * Q*

where v_quat = (0, v.x, v.y, v.z)   // "pure" quaternion
```

```rust
impl Quaternion {
    pub fn rotate_vector(&self, v: &Vector3) -> Vector3 {
        let v_quat = Quaternion { w: 0.0, x: v.x, y: v.y, z: v.z };
        let result = self.multiply(&v_quat).multiply(&self.conjugate());
        Vector3 {
            x: result.x,
            y: result.y,
            z: result.z,
        }
    }
}
```

### 4.5 Quaternion to Forward Vector

Documented in [algorithms.md, Section 8.1](./algorithms.md#81-quaternion-to-forward-vector).

The forward vector is obtained by rotating the reference direction `[0, 0, -1]` (camera pointing into the screen) by the device quaternion:

```rust
pub fn quaternion_to_forward(q: &Quaternion) -> Vector3 {
    q.rotate_vector(&Vector3 { x: 0.0, y: 0.0, z: -1.0 })
     .normalize()
}
```

### 4.6 Why Quaternions Over Euler Angles

Euler angles (yaw, pitch, roll) suffer from **gimbal lock**: when pitch approaches +/-90 degrees, yaw and roll become indistinguishable, causing discontinuities and singularities. Since users will frequently point their phones straight up (pitch = +90), Euler angles would fail at exactly the most common use case.

Quaternions avoid this entirely:

| Property | Euler Angles | Quaternions |
|----------|-------------|-------------|
| Gimbal lock | Yes, at +/-90 pitch | No |
| Interpolation | Discontinuous | Smooth (SLERP) |
| Composition | 3 separate rotations | Single multiplication |
| Storage | 3 floats | 4 floats |
| Numerical drift | Requires re-orthogonalization | Simple renormalization |

---

## 5. Quaternion from IMU

### 5.1 Sensor Fusion Output

Mobile devices provide a fused orientation quaternion via the platform's sensor fusion API:

- **Android**: `SensorManager.getRotationVector()` returns `(x, y, z, w)` in the Android Rotation Vector convention
- **iOS**: `CMMotionManager.deviceMotion.attitude.quaternion` returns `(x, y, z, w)` in the Core Motion convention

### 5.2 Reference Frame Alignment

Both platforms define the world frame differently from the engine's East-Up-North convention. The application layer applies a correction rotation before passing the quaternion to the engine:

```
Android world frame: X=East, Y=North, Z=Up
Engine world frame:  X=East, Y=Up,    Z=North

Correction: 90° rotation around X-axis
Q_engine = Q_correction * Q_android
```

This correction is applied once in the TypeScript bridge, not in the Rust engine, to keep the engine platform-agnostic.

---

## 6. Numerical Stability

### 6.1 Quaternion Renormalization

After repeated multiplications, quaternion magnitude drifts from 1.0 due to floating-point accumulation. The engine renormalizes after every composition:

```rust
impl Quaternion {
    pub fn normalize(&self) -> Quaternion {
        let mag = (self.w * self.w + self.x * self.x
                 + self.y * self.y + self.z * self.z).sqrt();
        Quaternion {
            w: self.w / mag,
            x: self.x / mag,
            y: self.y / mag,
            z: self.z / mag,
        }
    }
}
```

In practice, the device quaternion is freshly provided each frame, so renormalization is primarily a safety measure for future multi-step rotation chains.

### 6.2 Acos Input Clamping

As detailed in Section 2.3, all `acos` inputs are clamped to [-1, 1]. This is the single most important numerical safety measure in the engine.

### 6.3 f64 Precision Considerations

All operations use `f64` (64-bit IEEE 754 double precision), providing:

- 52-bit mantissa (approximately 15-16 significant decimal digits)
- Range: approximately 5e-324 to 1.8e+308
- Machine epsilon: approximately 2.2e-16

For the engine's purposes, the precision-limiting factors are the astronomical models (arcminute-level accuracy), not the floating-point representation. Switching to `f128` would provide no practical benefit.

---

## 7. Cross-References

- **[Core Astronomical Algorithms, Section 4](./algorithms.md#4-angular-distance)** -- Angular distance and direction vector pseudocode
- **[Core Astronomical Algorithms, Section 8](./algorithms.md#8-quaternion-operations)** -- Quaternion multiplication and forward vector
- **[Coordinate Transforms, Section 4](./coordinate-transforms.md#4-device-frame-transformation)** -- How quaternions integrate with coordinate transforms
- **[Error Bounds, Section 2](./error-bounds.md)** -- IMU sensor noise and its effect on guidance accuracy
- **[Testing Overview, Section 1.3](../08-testing/overview.md#13-vector-math-tests)** -- Vector and quaternion unit tests

---

**Document Status**: Complete
**Version**: 1.0
**Last Updated**: February 2026
