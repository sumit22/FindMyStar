-- Solar System Objects (10 objects)
-- RA/Dec are NULL because positions are computed at runtime by the Rust engine.

INSERT INTO objects (name, common_name, type, ra, dec, magnitude, planet_id, distance_ly, description)
VALUES ('Sun', 'Sun', 'sun', NULL, NULL, -26.74, NULL, NULL, 'The star at the center of the Solar System.');

INSERT INTO objects (name, common_name, type, ra, dec, magnitude, planet_id, distance_ly, description)
VALUES ('Moon', 'Moon', 'moon', NULL, NULL, -12.60, NULL, NULL, 'Earth''s natural satellite.');

INSERT INTO objects (name, common_name, type, ra, dec, magnitude, planet_id, distance_ly, description)
VALUES ('Mercury', 'Mercury', 'planet', NULL, NULL, -0.36, 1, NULL, 'Smallest planet and closest to the Sun.');

INSERT INTO objects (name, common_name, type, ra, dec, magnitude, planet_id, distance_ly, description)
VALUES ('Venus', 'Venus', 'planet', NULL, NULL, -4.40, 2, NULL, 'Second planet from the Sun, brightest planet in the sky.');

INSERT INTO objects (name, common_name, type, ra, dec, magnitude, planet_id, distance_ly, description)
VALUES ('Mars', 'Mars', 'planet', NULL, NULL, -2.91, 3, NULL, 'The Red Planet, fourth from the Sun.');

INSERT INTO objects (name, common_name, type, ra, dec, magnitude, planet_id, distance_ly, description)
VALUES ('Jupiter', 'Jupiter', 'planet', NULL, NULL, -2.94, 4, NULL, 'Largest planet in the Solar System.');

INSERT INTO objects (name, common_name, type, ra, dec, magnitude, planet_id, distance_ly, description)
VALUES ('Saturn', 'Saturn', 'planet', NULL, NULL, -0.55, 5, NULL, 'Ringed gas giant, sixth planet from the Sun.');

INSERT INTO objects (name, common_name, type, ra, dec, magnitude, planet_id, distance_ly, description)
VALUES ('Uranus', 'Uranus', 'planet', NULL, NULL, 5.32, 6, NULL, 'Ice giant with extreme axial tilt.');

INSERT INTO objects (name, common_name, type, ra, dec, magnitude, planet_id, distance_ly, description)
VALUES ('Neptune', 'Neptune', 'planet', NULL, NULL, 7.78, 7, NULL, 'Most distant planet in the Solar System.');
