use crate::math::utils::{deg_to_rad, normalize_degrees, normalize_hours, rad_to_deg, safe_asin};

/// Planet identifiers (1-based to match database planet_id).
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Planet {
    Mercury = 1,
    Venus = 2,
    Mars = 3,
    Jupiter = 4,
    Saturn = 5,
    Uranus = 6,
    Neptune = 7,
}

impl Planet {
    pub fn from_id(id: u32) -> Option<Planet> {
        match id {
            1 => Some(Planet::Mercury),
            2 => Some(Planet::Venus),
            3 => Some(Planet::Mars),
            4 => Some(Planet::Jupiter),
            5 => Some(Planet::Saturn),
            6 => Some(Planet::Uranus),
            7 => Some(Planet::Neptune),
            _ => None,
        }
    }
}

/// Orbital elements at J2000.0 with century rates (Standish 1992).
struct OrbitalElements {
    e0: f64,
    e1: f64,
    i0: f64,
    i1: f64,
    l0: f64,
    l1: f64,
    w0: f64,
    w1: f64,
    om0: f64,
    om1: f64,
}

fn get_orbital_elements(planet: Planet) -> OrbitalElements {
    match planet {
        Planet::Mercury => OrbitalElements {
            e0: 0.20563593,
            e1: 0.00001906,
            i0: 7.00497902,
            i1: -0.00594749,
            l0: 252.25032350,
            l1: 149472.67411175,
            w0: 77.45779628,
            w1: 0.16047689,
            om0: 48.33076593,
            om1: -0.12534081,
        },
        Planet::Venus => OrbitalElements {
            e0: 0.00677672,
            e1: -0.00004107,
            i0: 3.39467605,
            i1: -0.00078890,
            l0: 181.97909950,
            l1: 58517.81538729,
            w0: 131.60246718,
            w1: 0.00268329,
            om0: 76.67984255,
            om1: -0.27769418,
        },
        Planet::Mars => OrbitalElements {
            e0: 0.09339410,
            e1: 0.00007882,
            i0: 1.84969142,
            i1: -0.00813131,
            l0: -4.55343205,
            l1: 19140.30268499,
            w0: -23.94362959,
            w1: 0.44441088,
            om0: 49.55953891,
            om1: -0.29257343,
        },
        Planet::Jupiter => OrbitalElements {
            e0: 0.04838624,
            e1: -0.00013253,
            i0: 1.30326698,
            i1: -0.00183714,
            l0: 34.39644051,
            l1: 3034.74612775,
            w0: 14.72847983,
            w1: 0.21252668,
            om0: 100.47390909,
            om1: 0.20469106,
        },
        Planet::Saturn => OrbitalElements {
            e0: 0.05386179,
            e1: -0.00050991,
            i0: 2.48599187,
            i1: 0.00193609,
            l0: 49.95424423,
            l1: 1222.49362201,
            w0: 92.59887831,
            w1: -0.41897216,
            om0: 113.66242448,
            om1: -0.28867794,
        },
        Planet::Uranus => OrbitalElements {
            e0: 0.04725744,
            e1: -0.00004397,
            i0: 0.77263783,
            i1: -0.00242939,
            l0: 313.23810451,
            l1: 428.48202785,
            w0: 170.95427630,
            w1: 0.40805281,
            om0: 74.01692503,
            om1: 0.04240589,
        },
        Planet::Neptune => OrbitalElements {
            e0: 0.00859048,
            e1: 0.00005105,
            i0: 1.77004347,
            i1: 0.00035372,
            l0: -55.12002969,
            l1: 218.45945325,
            w0: 44.96476227,
            w1: -0.32241464,
            om0: 131.78422574,
            om1: -0.00508664,
        },
    }
}

fn get_earth_elements() -> OrbitalElements {
    OrbitalElements {
        e0: 0.01671123,
        e1: -0.00004392,
        i0: -0.00001531,
        i1: -0.01294668,
        l0: 100.46457166,
        l1: 35999.37244981,
        w0: 102.93768193,
        w1: 0.32327364,
        om0: 0.0,
        om1: 0.0,
    }
}

/// Solves Kepler's equation M = E - e*sin(E) iteratively.
fn solve_kepler(m_rad: f64, e: f64) -> f64 {
    let mut big_e = m_rad + e * m_rad.sin();
    for _ in 0..15 {
        let de = (m_rad - (big_e - e * big_e.sin())) / (1.0 - e * big_e.cos());
        big_e += de;
        if de.abs() < 1e-12 {
            break;
        }
    }
    big_e
}

fn heliocentric_position(elements: &OrbitalElements, t: f64) -> (f64, f64, f64) {
    let e = elements.e0 + elements.e1 * t;
    let i = deg_to_rad(elements.i0 + elements.i1 * t);
    let l = normalize_degrees(elements.l0 + elements.l1 * t);
    let w = normalize_degrees(elements.w0 + elements.w1 * t);
    let om = normalize_degrees(elements.om0 + elements.om1 * t);

    let m_rad = deg_to_rad(normalize_degrees(l - w));
    let big_e = solve_kepler(m_rad, e);

    let x_prime = big_e.cos() - e;
    let y_prime = (1.0 - e * e).sqrt() * big_e.sin();
    let nu = y_prime.atan2(x_prime);
    let r = (x_prime * x_prime + y_prime * y_prime).sqrt();

    let om_rad = deg_to_rad(om);
    let w_rad = deg_to_rad(w) - om_rad;

    let x =
        r * ((om_rad.cos() * (w_rad + nu).cos()) - (om_rad.sin() * (w_rad + nu).sin() * i.cos()));
    let y =
        r * ((om_rad.sin() * (w_rad + nu).cos()) + (om_rad.cos() * (w_rad + nu).sin() * i.cos()));
    let z = r * ((w_rad + nu).sin() * i.sin());
    (x, y, z)
}

/// Computes a planet's geocentric equatorial position (RA/Dec) for a given Julian Date.
///
/// # Returns
/// `(ra_hours, dec_degrees)` where RA is 0-24 and Dec is -90 to +90.
pub fn compute_planet_position(planet: Planet, jd: f64) -> (f64, f64) {
    let t = (jd - 2_451_545.0) / 36_525.0;

    let (xp, yp, zp) = heliocentric_position(&get_orbital_elements(planet), t);
    let (xe, ye, ze) = heliocentric_position(&get_earth_elements(), t);

    let (xg, yg, zg) = (xp - xe, yp - ye, zp - ze);
    let epsilon = deg_to_rad(23.439291 - 0.013004 * t);

    let xeq = xg;
    let yeq = yg * epsilon.cos() - zg * epsilon.sin();
    let zeq = yg * epsilon.sin() + zg * epsilon.cos();

    let ra_hours = normalize_hours(rad_to_deg(yeq.atan2(xeq)) / 15.0);
    let dec_degrees = rad_to_deg(safe_asin(zeq / (xeq * xeq + yeq * yeq + zeq * zeq).sqrt()));
    (ra_hours, dec_degrees)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::coordinates::time::JD_J2000;

    #[test]
    fn test_all_planets_valid_range() {
        let planets = [
            Planet::Mercury,
            Planet::Venus,
            Planet::Mars,
            Planet::Jupiter,
            Planet::Saturn,
            Planet::Uranus,
            Planet::Neptune,
        ];
        for planet in &planets {
            let (ra, dec) = compute_planet_position(*planet, JD_J2000 + 8000.0);
            assert!(ra >= 0.0 && ra < 24.0, "{:?} RA={ra}", planet);
            assert!(dec.abs() < 90.0, "{:?} Dec={dec}", planet);
        }
    }

    #[test]
    fn test_planet_from_id() {
        assert_eq!(Planet::from_id(1), Some(Planet::Mercury));
        assert_eq!(Planet::from_id(7), Some(Planet::Neptune));
        assert_eq!(Planet::from_id(0), None);
        assert_eq!(Planet::from_id(8), None);
    }

    #[test]
    fn test_jupiter_moves_slowly() {
        let (ra1, _) = compute_planet_position(Planet::Jupiter, JD_J2000);
        let (ra2, _) = compute_planet_position(Planet::Jupiter, JD_J2000 + 30.0);
        let diff = ((ra2 - ra1 + 12.0) % 24.0 - 12.0).abs();
        assert!(diff < 2.0, "Jupiter RA diff={diff}h over 30 days");
    }

    #[test]
    fn test_kepler_equation() {
        let big_e = solve_kepler(1.5, 0.2);
        let check = big_e - 0.2 * big_e.sin();
        assert!((check - 1.5).abs() < 1e-10);
    }
}
