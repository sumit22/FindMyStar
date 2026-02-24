// FindMyStar-Bridging-Header.h
// C declarations for Rust core engine FFI functions.
// Must match core/src/ffi/exports.rs exactly.

#ifndef findmystar_bridging_header_h
#define findmystar_bridging_header_h

#include <stdint.h>

// --- FFI Structs ---

typedef struct {
    double altitude;
    double azimuth;
    int32_t error_code;
} FfiAltAz;

typedef struct {
    double direction_deg;
    double distance_deg;
    int32_t error_code;
} FfiTrackingResult;

typedef struct {
    double rise_ms;
    double set_ms;
    int32_t status; // 0=rises/sets, 1=always visible, 2=never visible, -1=error
} FfiRiseSetResult;

typedef struct {
    double altitude;
    double azimuth;
    double dir_x;
    double dir_y;
    double dir_z;
    int32_t error_code;
} FfiObjectTrackingResult;

// --- FFI Functions ---

// Convert RA/Dec to altitude/azimuth
FfiAltAz ffi_ra_dec_to_altaz(double ra_hours, double dec_deg, double lat_deg, double lon_deg, double unix_ms);

// Compute position of a known object (out params)
int32_t ffi_compute_position(int32_t object_type, uint32_t object_id, double unix_ms, double *out_ra, double *out_dec);

// Device tracking: quaternion-to-target direction
FfiTrackingResult ffi_compute_tracking(double target_x, double target_y, double target_z,
                                       double qw, double qx, double qy, double qz);

// Object tracking by engine ID (Sun/Moon/Planet/Star) → alt/az/direction
FfiObjectTrackingResult ffi_compute_tracking_object(int32_t object_type, uint32_t object_id,
                                                     double lat_deg, double lon_deg, double unix_ms);

// Object tracking by raw RA/Dec → alt/az/direction
FfiObjectTrackingResult ffi_compute_tracking_radec(double ra_hours, double dec_deg,
                                                    double lat_deg, double lon_deg, double unix_ms);

// Rise/set for raw RA/Dec coordinates (stars, deep-sky)
FfiRiseSetResult ffi_compute_rise_set(double ra_hours, double dec_deg, double lat_deg, double lon_deg, double start_unix_ms);

// Rise/set for engine-path objects (Sun/Moon/Planet/Star by ID)
FfiRiseSetResult ffi_compute_rise_set_object(int32_t object_type, uint32_t object_id,
                                              double lat_deg, double lon_deg, double start_unix_ms);

// Convert alt/az to direction vector (out params)
int32_t ffi_altaz_to_vector3(double alt_deg, double az_deg, double *out_x, double *out_y, double *out_z);

// Angular distance between two unit vectors (degrees)
double ffi_angular_distance(double x1, double y1, double z1, double x2, double y2, double z2);

// Twilight classification: 0=Day, 1=Civil, 2=Nautical, 3=Astronomical, 4=Night
int32_t ffi_classify_twilight(double sun_alt_deg);

// Entitlement: create signed blob (57 bytes) bound to device
// device_id_ptr/len: raw device identifier (hashed internally)
// Returns 0 on success, -1 on invalid plan type, -2 on buffer too small, -3 on null pointer
int32_t ffi_create_entitlement(uint8_t plan_type, uint64_t valid_until_ms,
                                const uint8_t *device_id_ptr, int32_t device_id_len,
                                uint8_t *out_buf, int32_t buf_len);

// Entitlement: verify blob and check pro status
// Returns 1=pro active, 0=not pro, -1=invalid signature/device, -2=invalid input
int32_t ffi_check_entitlement(const uint8_t *buf, int32_t buf_len,
                               const uint8_t *device_id_ptr, int32_t device_id_len,
                               uint64_t now_ms);

// Engine version string
const char* ffi_core_version(void);

#endif
