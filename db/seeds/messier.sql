-- Messier Catalog (110 deep-sky objects)
-- J2000.0 coordinates, grouped by type

-- Nebulae (~27 objects)
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M1', 'Crab Nebula', 'nebula', 5.5753, 22.0145, 8.4, 6500, 'Supernova remnant in Taurus.', 0);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M8', 'Lagoon Nebula', 'nebula', 18.0633, -24.3833, 6.0, 5200, 'Emission nebula in Sagittarius.', 0);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M16', 'Eagle Nebula', 'nebula', 18.3133, -13.7833, 6.0, 7000, 'Home of the Pillars of Creation.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M17', 'Omega Nebula', 'nebula', 18.3400, -16.1833, 6.0, 5500, 'Emission nebula in Sagittarius.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M20', 'Trifid Nebula', 'nebula', 18.0367, -23.0333, 6.3, 5200, 'Emission, reflection, and dark nebula.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M27', 'Dumbbell Nebula', 'planetary_nebula', 19.9933, 22.7217, 7.5, 1360, 'Brightest planetary nebula in the sky.', 0);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M42', 'Orion Nebula', 'nebula', 5.5883, -5.3911, 4.0, 1344, 'Brightest diffuse nebula, visible to naked eye.', 0);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M43', NULL, 'nebula', 5.5917, -5.2667, 9.0, 1600, 'Part of the Orion Nebula complex.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M57', 'Ring Nebula', 'planetary_nebula', 18.8933, 33.0286, 8.8, 2283, 'Classic planetary nebula in Lyra.', 0);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M76', 'Little Dumbbell', 'planetary_nebula', 1.7033, 51.5753, 10.1, 2500, 'Planetary nebula in Perseus.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M78', NULL, 'nebula', 5.7800, 0.0500, 8.3, 1600, 'Reflection nebula in Orion.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M97', 'Owl Nebula', 'planetary_nebula', 11.2467, 55.0189, 9.9, 2030, 'Planetary nebula in Ursa Major.', 1);

-- Galaxies (~40 objects)
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M31', 'Andromeda Galaxy', 'galaxy', 0.7123, 41.2689, 3.4, 2537000, 'Nearest large spiral galaxy to the Milky Way.', 0);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M32', NULL, 'galaxy', 0.7108, 40.8653, 8.1, 2490000, 'Satellite galaxy of Andromeda.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M33', 'Triangulum Galaxy', 'galaxy', 1.5642, 30.6603, 5.7, 2730000, 'Third largest galaxy in the Local Group.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M49', NULL, 'galaxy', 12.4967, 8.0003, 8.4, 56000000, 'Brightest galaxy in the Virgo Cluster.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M51', 'Whirlpool Galaxy', 'galaxy', 13.4983, 47.1953, 8.4, 23000000, 'Classic face-on spiral with companion NGC 5195.', 0);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M58', NULL, 'galaxy', 12.6250, 11.8178, 9.7, 62000000, 'Barred spiral galaxy in Virgo.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M59', NULL, 'galaxy', 12.7000, 11.6472, 9.6, 60000000, 'Elliptical galaxy in Virgo.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M60', NULL, 'galaxy', 12.7267, 11.5528, 8.8, 55000000, 'Giant elliptical galaxy in Virgo.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M61', NULL, 'galaxy', 12.3650, 4.4736, 9.7, 52500000, 'Face-on spiral galaxy in Virgo.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M63', 'Sunflower Galaxy', 'galaxy', 13.2633, 42.0294, 8.6, 37000000, 'Flocculent spiral galaxy.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M64', 'Black Eye Galaxy', 'galaxy', 12.9483, 21.6828, 8.5, 24000000, 'Galaxy with prominent dark band of dust.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M65', NULL, 'galaxy', 11.3133, 13.0922, 9.3, 35000000, 'Member of the Leo Triplet.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M66', NULL, 'galaxy', 11.3367, 12.9917, 8.9, 36000000, 'Member of the Leo Triplet.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M74', 'Phantom Galaxy', 'galaxy', 1.6117, 15.7836, 9.4, 35000000, 'Face-on grand-design spiral.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M77', 'Cetus A', 'galaxy', 2.7117, -0.0133, 8.9, 47000000, 'Seyfert galaxy in Cetus.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M81', 'Bode''s Galaxy', 'galaxy', 9.9267, 69.0653, 6.9, 12000000, 'Grand-design spiral in Ursa Major.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M82', 'Cigar Galaxy', 'galaxy', 9.9283, 69.6808, 8.4, 12000000, 'Starburst galaxy near M81.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M83', 'Southern Pinwheel', 'galaxy', 13.6150, -29.8667, 7.6, 15000000, 'Barred spiral galaxy in Hydra.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M84', NULL, 'galaxy', 12.4167, 12.8869, 9.1, 60000000, 'Elliptical galaxy in Virgo.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M86', NULL, 'galaxy', 12.4350, 12.9469, 8.9, 52000000, 'Elliptical galaxy in Virgo.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M87', 'Virgo A', 'galaxy', 12.5133, 12.3911, 8.6, 53500000, 'Giant elliptical galaxy with famous jet.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M88', NULL, 'galaxy', 12.5317, 14.4203, 9.6, 47000000, 'Spiral galaxy in Virgo.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M89', NULL, 'galaxy', 12.5933, 12.5564, 9.8, 50000000, 'Near-circular elliptical in Virgo.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M90', NULL, 'galaxy', 12.6133, 13.1625, 9.5, 60000000, 'Spiral galaxy in Virgo, blueshifted.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M91', NULL, 'galaxy', 12.5917, 14.4964, 10.2, 63000000, 'Barred spiral in Virgo.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M94', NULL, 'galaxy', 12.8467, 41.1203, 8.2, 16000000, 'Starburst galaxy in Canes Venatici.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M95', NULL, 'galaxy', 10.7300, 11.7039, 9.7, 33000000, 'Barred spiral in Leo.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M96', NULL, 'galaxy', 10.7800, 11.8194, 9.2, 34000000, 'Spiral galaxy in Leo.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M98', NULL, 'galaxy', 12.2267, 14.9003, 10.1, 44000000, 'Spiral galaxy in Virgo.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M99', NULL, 'galaxy', 12.3133, 14.4164, 9.9, 55000000, 'Grand-design spiral in Virgo.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M100', NULL, 'galaxy', 12.3817, 15.8231, 9.3, 55000000, 'Grand-design spiral in Virgo.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M101', 'Pinwheel Galaxy', 'galaxy', 14.0533, 54.3492, 7.9, 21000000, 'Face-on spiral in Ursa Major.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M104', 'Sombrero Galaxy', 'galaxy', 12.6667, -11.6231, 8.0, 31000000, 'Edge-on galaxy with prominent dust lane.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M105', NULL, 'galaxy', 10.7967, 12.5822, 9.3, 32000000, 'Elliptical galaxy in Leo.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M106', NULL, 'galaxy', 12.3133, 47.3039, 8.4, 24000000, 'Spiral galaxy in Canes Venatici.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M108', NULL, 'galaxy', 11.1867, 55.6739, 10.0, 45000000, 'Edge-on spiral near the Owl Nebula.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M109', NULL, 'galaxy', 11.9600, 53.3744, 9.8, 55000000, 'Barred spiral in Ursa Major.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M110', NULL, 'galaxy', 0.6733, 41.6853, 8.5, 2690000, 'Satellite galaxy of Andromeda.', 1);

-- Clusters (~51 objects)
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M2', NULL, 'cluster', 21.5567, -0.8231, 6.5, 37500, 'Globular cluster in Aquarius.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M3', NULL, 'cluster', 13.7033, 28.3769, 6.2, 33900, 'Globular cluster in Canes Venatici.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M4', NULL, 'cluster', 16.3917, -26.5258, 5.6, 7200, 'Nearest globular cluster to Earth.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M5', NULL, 'cluster', 15.3100, 2.0831, 5.6, 24500, 'Globular cluster in Serpens.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M6', 'Butterfly Cluster', 'cluster', 17.6700, -32.2167, 4.2, 1600, 'Open cluster in Scorpius.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M7', 'Ptolemy Cluster', 'cluster', 17.8967, -34.8167, 3.3, 980, 'Open cluster in Scorpius.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M9', NULL, 'cluster', 17.3200, -18.5167, 7.7, 25800, 'Globular cluster in Ophiuchus.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M10', NULL, 'cluster', 16.9533, -4.1000, 6.6, 14300, 'Globular cluster in Ophiuchus.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M11', 'Wild Duck Cluster', 'cluster', 18.8500, -6.2667, 6.3, 6200, 'Rich open cluster in Scutum.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M12', NULL, 'cluster', 16.7867, -1.9500, 6.7, 15700, 'Globular cluster in Ophiuchus.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M13', 'Great Hercules Cluster', 'cluster', 16.6950, 36.4614, 5.8, 25100, 'Best known globular cluster in the northern sky.', 0);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M14', NULL, 'cluster', 17.6267, -3.2500, 7.6, 30300, 'Globular cluster in Ophiuchus.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M15', NULL, 'cluster', 21.4983, 12.1672, 6.2, 33600, 'Dense globular cluster in Pegasus.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M18', NULL, 'cluster', 18.3300, -17.1333, 7.5, 4900, 'Open cluster in Sagittarius.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M19', NULL, 'cluster', 17.0433, -26.2667, 6.8, 28700, 'Oblate globular cluster in Ophiuchus.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M21', NULL, 'cluster', 18.0733, -22.5000, 6.5, 4250, 'Open cluster near the Trifid Nebula.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M22', NULL, 'cluster', 18.6067, -23.9000, 5.1, 10600, 'Bright globular in Sagittarius.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M23', NULL, 'cluster', 17.9467, -19.0167, 6.9, 2150, 'Open cluster in Sagittarius.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M24', 'Sagittarius Star Cloud', 'cluster', 18.2833, -18.4833, 4.6, 10000, 'Dense Milky Way star cloud.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M25', NULL, 'cluster', 18.5267, -19.2333, 6.5, 2000, 'Open cluster in Sagittarius.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M26', NULL, 'cluster', 18.7500, -9.4000, 8.0, 5000, 'Open cluster in Scutum.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M28', NULL, 'cluster', 18.4100, -24.8700, 6.8, 18300, 'Globular cluster in Sagittarius.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M29', NULL, 'cluster', 20.3967, 38.5167, 7.1, 4000, 'Open cluster in Cygnus.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M30', NULL, 'cluster', 21.6733, -23.1833, 7.2, 26100, 'Globular cluster in Capricornus.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M34', NULL, 'cluster', 2.7000, 42.7833, 5.5, 1500, 'Open cluster in Perseus.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M35', NULL, 'cluster', 6.1467, 24.3333, 5.3, 2800, 'Open cluster in Gemini.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M36', NULL, 'cluster', 5.6000, 34.1333, 6.3, 4100, 'Open cluster in Auriga.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M37', NULL, 'cluster', 5.8733, 32.5500, 6.2, 4500, 'Richest open cluster in Auriga.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M38', NULL, 'cluster', 5.4733, 35.8333, 7.4, 4200, 'Open cluster in Auriga.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M39', NULL, 'cluster', 21.5333, 48.4333, 4.6, 825, 'Open cluster in Cygnus.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M41', NULL, 'cluster', 6.7833, -20.7333, 4.5, 2300, 'Open cluster near Sirius.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M44', 'Beehive Cluster', 'cluster', 8.6700, 19.9833, 3.7, 577, 'Large open cluster in Cancer, Praesepe.', 0);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M45', 'Pleiades', 'cluster', 3.7833, 24.1167, 1.6, 444, 'The Seven Sisters, most famous open cluster.', 0);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M46', NULL, 'cluster', 7.6967, -14.8167, 6.1, 5400, 'Open cluster in Puppis.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M47', NULL, 'cluster', 7.6100, -14.5000, 4.2, 1600, 'Bright open cluster in Puppis.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M48', NULL, 'cluster', 8.2267, -5.8000, 5.8, 1500, 'Open cluster in Hydra.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M50', NULL, 'cluster', 7.0533, -8.3333, 5.9, 3200, 'Open cluster in Monoceros.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M52', NULL, 'cluster', 23.4067, 61.5833, 7.3, 5000, 'Open cluster in Cassiopeia.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M53', NULL, 'cluster', 13.2150, 18.1681, 7.6, 58000, 'Globular cluster in Coma Berenices.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M54', NULL, 'cluster', 18.9183, -30.4833, 7.6, 87000, 'Globular, may belong to Sagittarius Dwarf Galaxy.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M55', NULL, 'cluster', 19.6667, -30.9667, 6.3, 17300, 'Loose globular cluster in Sagittarius.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M56', NULL, 'cluster', 19.2767, 30.1833, 8.3, 32900, 'Globular cluster in Lyra.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M62', NULL, 'cluster', 17.0233, -30.1167, 6.5, 22200, 'Asymmetric globular in Ophiuchus.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M67', NULL, 'cluster', 8.8433, 11.8167, 6.1, 2700, 'Old open cluster in Cancer.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M68', NULL, 'cluster', 12.6583, -26.7500, 7.8, 33300, 'Globular cluster in Hydra.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M69', NULL, 'cluster', 18.5233, -32.3500, 7.6, 29700, 'Globular cluster in Sagittarius.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M70', NULL, 'cluster', 18.7200, -32.3000, 7.9, 29300, 'Globular cluster in Sagittarius.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M71', NULL, 'cluster', 19.8967, 18.7833, 8.2, 13000, 'Loose globular cluster in Sagitta.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M72', NULL, 'cluster', 20.8900, -12.5333, 9.3, 55000, 'Remote globular cluster in Aquarius.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M73', NULL, 'cluster', 20.9833, -12.6333, 9.0, 2500, 'Asterism of 4 stars in Aquarius.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M75', NULL, 'cluster', 20.1017, -21.9167, 8.5, 67500, 'Dense globular cluster in Sagittarius.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M79', NULL, 'cluster', 5.4067, -24.5167, 7.7, 41000, 'Globular cluster in Lepus.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M80', NULL, 'cluster', 16.2833, -22.9833, 7.3, 32600, 'Dense globular cluster in Scorpius.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M85', NULL, 'cluster', 12.4217, 18.1911, 9.1, 60000000, 'Lenticular galaxy in Virgo.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M92', NULL, 'cluster', 17.2850, 43.1364, 6.4, 26700, 'Globular cluster in Hercules.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M93', NULL, 'cluster', 7.7467, -23.8667, 6.0, 3600, 'Open cluster in Puppis.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M103', NULL, 'cluster', 1.5567, 60.6500, 7.4, 8500, 'Open cluster in Cassiopeia.', 1);
INSERT INTO objects (name, common_name, type, ra, dec, magnitude, distance_ly, description, is_pro) VALUES
('M107', NULL, 'cluster', 16.5417, -13.0500, 7.9, 20900, 'Globular cluster in Ophiuchus.', 1);
