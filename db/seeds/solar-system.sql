-- Solar System Objects (10 objects)
-- RA/Dec are NULL because positions are computed at runtime by the Rust engine.

INSERT INTO objects (name, common_name, type, ra, dec, magnitude, planet_id, distance_ly, description, is_pro)
VALUES ('Sun', 'Sun', 'sun', NULL, NULL, -26.74, NULL, NULL, 'The star at the center of the Solar System.', 0);

INSERT INTO objects (name, common_name, type, ra, dec, magnitude, planet_id, distance_ly, description, is_pro)
VALUES ('Moon', 'Moon', 'moon', NULL, NULL, -12.60, NULL, NULL, 'Earth''s natural satellite.', 0);

INSERT INTO objects (name, common_name, type, ra, dec, magnitude, planet_id, distance_ly, description, is_pro)
VALUES ('Mercury', 'Mercury', 'planet', NULL, NULL, -0.36, 1, NULL, 'Smallest planet and closest to the Sun.', 0);

INSERT INTO objects (name, common_name, type, ra, dec, magnitude, planet_id, distance_ly, description, is_pro)
VALUES ('Venus', 'Venus', 'planet', NULL, NULL, -4.40, 2, NULL, 'Second planet from the Sun, brightest planet in the sky.', 0);

INSERT INTO objects (name, common_name, type, ra, dec, magnitude, planet_id, distance_ly, description, is_pro)
VALUES ('Mars', 'Mars', 'planet', NULL, NULL, -2.91, 3, NULL, 'The Red Planet, fourth from the Sun.', 0);

INSERT INTO objects (name, common_name, type, ra, dec, magnitude, planet_id, distance_ly, description, is_pro)
VALUES ('Jupiter', 'Jupiter', 'planet', NULL, NULL, -2.94, 4, NULL, 'Largest planet in the Solar System.', 0);

INSERT INTO objects (name, common_name, type, ra, dec, magnitude, planet_id, distance_ly, description, is_pro)
VALUES ('Saturn', 'Saturn', 'planet', NULL, NULL, -0.55, 5, NULL, 'Ringed gas giant, sixth planet from the Sun.', 0);

INSERT INTO objects (name, common_name, type, ra, dec, magnitude, planet_id, distance_ly, description, is_pro)
VALUES ('Uranus', 'Uranus', 'planet', NULL, NULL, 5.32, 6, NULL, 'Ice giant with extreme axial tilt.', 0);

INSERT INTO objects (name, common_name, type, ra, dec, magnitude, planet_id, distance_ly, description, is_pro)
VALUES ('Neptune', 'Neptune', 'planet', NULL, NULL, 7.78, 7, NULL, 'Most distant planet in the Solar System.', 0);
