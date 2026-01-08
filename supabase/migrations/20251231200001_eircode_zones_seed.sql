-- ================================================
-- EIRCODE ZONES SEED DATA
-- ================================================
-- Irish Eircode routing keys with zone names, counties,
-- adjacent keys, and approximate centroids for map display
-- ================================================

-- Dublin routing keys (D01-D24)
INSERT INTO public.eircode_zones (routing_key, zone_name, county, adjacent_keys, lat, lng) VALUES
('D01', 'Dublin 1', 'Dublin', ARRAY['D02', 'D03', 'D07', 'D09'], 53.3525, -6.2584),
('D02', 'Dublin 2', 'Dublin', ARRAY['D01', 'D04', 'D06', 'D08'], 53.3382, -6.2591),
('D03', 'Dublin 3', 'Dublin', ARRAY['D01', 'D05', 'D09', 'D13'], 53.3647, -6.2340),
('D04', 'Dublin 4', 'Dublin', ARRAY['D02', 'D06', 'D14', 'D18'], 53.3252, -6.2285),
('D05', 'Dublin 5', 'Dublin', ARRAY['D03', 'D09', 'D13', 'D17'], 53.3838, -6.2090),
('D06', 'Dublin 6', 'Dublin', ARRAY['D02', 'D04', 'D08', 'D12', 'D14'], 53.3196, -6.2654),
('D07', 'Dublin 7', 'Dublin', ARRAY['D01', 'D09', 'D11', 'D15'], 53.3582, -6.2881),
('D08', 'Dublin 8', 'Dublin', ARRAY['D02', 'D06', 'D10', 'D12'], 53.3358, -6.2930),
('D09', 'Dublin 9', 'Dublin', ARRAY['D01', 'D03', 'D05', 'D07', 'D11', 'D13'], 53.3750, -6.2550),
('D10', 'Dublin 10', 'Dublin', ARRAY['D08', 'D12', 'D20', 'D22'], 53.3380, -6.3420),
('D11', 'Dublin 11', 'Dublin', ARRAY['D07', 'D09', 'D13', 'D15'], 53.3880, -6.2880),
('D12', 'Dublin 12', 'Dublin', ARRAY['D06', 'D08', 'D10', 'D14', 'D24'], 53.3150, -6.3150),
('D13', 'Dublin 13', 'Dublin', ARRAY['D03', 'D05', 'D09', 'D11', 'D17'], 53.3950, -6.1850),
('D14', 'Dublin 14', 'Dublin', ARRAY['D04', 'D06', 'D12', 'D16', 'D18'], 53.2950, -6.2450),
('D15', 'Dublin 15', 'Dublin', ARRAY['D07', 'D11', 'K67'], 53.3950, -6.4050),
('D16', 'Dublin 16', 'Dublin', ARRAY['D14', 'D18', 'D24'], 53.2780, -6.2650),
('D17', 'Dublin 17', 'Dublin', ARRAY['D05', 'D13', 'K32', 'K45'], 53.4100, -6.1650),
('D18', 'Dublin 18', 'Dublin', ARRAY['D04', 'D14', 'D16', 'A94', 'A96'], 53.2650, -6.1750),
('D20', 'Dublin 20', 'Dublin', ARRAY['D10', 'D22', 'K78'], 53.3350, -6.3850),
('D22', 'Dublin 22', 'Dublin', ARRAY['D10', 'D20', 'D24', 'K78'], 53.3100, -6.3950),
('D24', 'Dublin 24', 'Dublin', ARRAY['D12', 'D16', 'D22'], 53.2850, -6.3550),
('K32', 'Malahide', 'Dublin', ARRAY['D05', 'D13', 'D17', 'K45'], 53.4500, -6.1500),
('K45', 'Swords', 'Dublin', ARRAY['D17', 'K32', 'K67'], 53.4600, -6.2200),
('K67', 'Blanchardstown', 'Dublin', ARRAY['D15', 'K45', 'K78'], 53.3900, -6.3800),
('K78', 'Lucan', 'Dublin', ARRAY['D20', 'D22', 'K67', 'W23'], 53.3550, -6.4500),
('A94', 'Blackrock', 'Dublin', ARRAY['D04', 'D18', 'A96'], 53.3000, -6.1750),
('A96', 'Glenageary', 'Dublin', ARRAY['D18', 'A94', 'A98'], 53.2750, -6.1350),
('A98', 'Bray', 'Wicklow', ARRAY['A96', 'A67'], 53.2050, -6.1000)
ON CONFLICT (routing_key) DO UPDATE SET
  zone_name = EXCLUDED.zone_name,
  county = EXCLUDED.county,
  adjacent_keys = EXCLUDED.adjacent_keys,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng;

-- Cork routing keys
INSERT INTO public.eircode_zones (routing_key, zone_name, county, adjacent_keys, lat, lng) VALUES
('T12', 'Cork City', 'Cork', ARRAY['T23', 'T45', 'T21', 'T56'], 51.8969, -8.4863),
('T21', 'Ballincollig', 'Cork', ARRAY['T12', 'T23', 'P31'], 51.8900, -8.5900),
('T23', 'Cork South', 'Cork', ARRAY['T12', 'T21', 'P31', 'P43'], 51.8500, -8.5000),
('T45', 'Glanmire', 'Cork', ARRAY['T12', 'T56', 'P25'], 51.9100, -8.4000),
('T56', 'Midleton', 'Cork', ARRAY['T12', 'T45', 'P25'], 51.9150, -8.1750),
('P31', 'Bandon', 'Cork', ARRAY['T21', 'T23', 'P43', 'P47'], 51.7450, -8.7400),
('P43', 'Kinsale', 'Cork', ARRAY['T23', 'P31'], 51.7050, -8.5300),
('P47', 'Clonakilty', 'Cork', ARRAY['P31', 'P72', 'P75'], 51.6200, -8.8700),
('P72', 'Bantry', 'Cork', ARRAY['P47', 'P75'], 51.6800, -9.4500),
('P75', 'Skibbereen', 'Cork', ARRAY['P47', 'P72'], 51.5550, -9.2650),
('P25', 'Youghal', 'Cork', ARRAY['T45', 'T56', 'X35'], 51.9550, -7.8500),
('P14', 'Fermoy', 'Cork', ARRAY['T45', 'P51', 'E25'], 52.1400, -8.2750),
('P51', 'Mallow', 'Cork', ARRAY['P14', 'P61', 'V93'], 52.1400, -8.6500),
('P61', 'Kanturk', 'Cork', ARRAY['P51', 'V93'], 52.1800, -8.9000)
ON CONFLICT (routing_key) DO UPDATE SET
  zone_name = EXCLUDED.zone_name,
  county = EXCLUDED.county,
  adjacent_keys = EXCLUDED.adjacent_keys,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng;

-- Galway routing keys
INSERT INTO public.eircode_zones (routing_key, zone_name, county, adjacent_keys, lat, lng) VALUES
('H91', 'Galway City', 'Galway', ARRAY['H54', 'H62', 'H65'], 53.2707, -9.0568),
('H54', 'Tuam', 'Galway', ARRAY['H91', 'F45'], 53.5150, -8.8550),
('H62', 'Loughrea', 'Galway', ARRAY['H91', 'H65', 'E45'], 53.1950, -8.5700),
('H65', 'Ballinasloe', 'Galway', ARRAY['H91', 'H62', 'N37', 'N39'], 53.3300, -8.2350)
ON CONFLICT (routing_key) DO UPDATE SET
  zone_name = EXCLUDED.zone_name,
  county = EXCLUDED.county,
  adjacent_keys = EXCLUDED.adjacent_keys,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng;

-- Limerick routing keys
INSERT INTO public.eircode_zones (routing_key, zone_name, county, adjacent_keys, lat, lng) VALUES
('V94', 'Limerick City', 'Limerick', ARRAY['V92', 'V93', 'V95', 'V35'], 52.6638, -8.6267),
('V93', 'Newcastle West', 'Limerick', ARRAY['V94', 'V31', 'P61'], 52.4500, -9.0600),
('V95', 'Shannon', 'Limerick', ARRAY['V94', 'V35', 'V15'], 52.7100, -8.8650),
('V35', 'Ennis', 'Clare', ARRAY['V94', 'V95', 'V15'], 52.8450, -8.9850),
('V31', 'Listowel', 'Kerry', ARRAY['V93', 'V92', 'V23'], 52.4450, -9.4850),
('V15', 'Ennistymon', 'Clare', ARRAY['V35', 'V95'], 52.9400, -9.2900)
ON CONFLICT (routing_key) DO UPDATE SET
  zone_name = EXCLUDED.zone_name,
  county = EXCLUDED.county,
  adjacent_keys = EXCLUDED.adjacent_keys,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng;

-- Kerry routing keys
INSERT INTO public.eircode_zones (routing_key, zone_name, county, adjacent_keys, lat, lng) VALUES
('V92', 'Tralee', 'Kerry', ARRAY['V31', 'V23', 'V93'], 52.2700, -9.7000),
('V23', 'Killarney', 'Kerry', ARRAY['V92', 'V31', 'P72'], 52.0600, -9.5100)
ON CONFLICT (routing_key) DO UPDATE SET
  zone_name = EXCLUDED.zone_name,
  county = EXCLUDED.county,
  adjacent_keys = EXCLUDED.adjacent_keys,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng;

-- Waterford routing keys
INSERT INTO public.eircode_zones (routing_key, zone_name, county, adjacent_keys, lat, lng) VALUES
('X91', 'Waterford City', 'Waterford', ARRAY['X35', 'X42', 'E32', 'Y35'], 52.2593, -7.1101),
('X35', 'Dungarvan', 'Waterford', ARRAY['X91', 'P25', 'E32'], 52.0900, -7.6200),
('X42', 'Tramore', 'Waterford', ARRAY['X91', 'Y35'], 52.1600, -7.1500)
ON CONFLICT (routing_key) DO UPDATE SET
  zone_name = EXCLUDED.zone_name,
  county = EXCLUDED.county,
  adjacent_keys = EXCLUDED.adjacent_keys,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng;

-- Kilkenny routing keys
INSERT INTO public.eircode_zones (routing_key, zone_name, county, adjacent_keys, lat, lng) VALUES
('R95', 'Kilkenny City', 'Kilkenny', ARRAY['E32', 'R93', 'R14'], 52.6541, -7.2448),
('E32', 'Callan', 'Kilkenny', ARRAY['R95', 'X91', 'E41'], 52.5450, -7.3900)
ON CONFLICT (routing_key) DO UPDATE SET
  zone_name = EXCLUDED.zone_name,
  county = EXCLUDED.county,
  adjacent_keys = EXCLUDED.adjacent_keys,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng;

-- Tipperary routing keys
INSERT INTO public.eircode_zones (routing_key, zone_name, county, adjacent_keys, lat, lng) VALUES
('E41', 'Clonmel', 'Tipperary', ARRAY['E32', 'E34', 'E25'], 52.3550, -7.7050),
('E34', 'Cashel', 'Tipperary', ARRAY['E41', 'E45', 'V92'], 52.5150, -7.8850),
('E45', 'Thurles', 'Tipperary', ARRAY['E34', 'E53', 'R95'], 52.6800, -7.8200),
('E25', 'Nenagh', 'Tipperary', ARRAY['E45', 'E53', 'V95'], 52.8600, -8.1950),
('E53', 'Roscrea', 'Tipperary', ARRAY['E45', 'E25', 'R42'], 52.9500, -7.8000)
ON CONFLICT (routing_key) DO UPDATE SET
  zone_name = EXCLUDED.zone_name,
  county = EXCLUDED.county,
  adjacent_keys = EXCLUDED.adjacent_keys,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng;

-- Wexford routing keys
INSERT INTO public.eircode_zones (routing_key, zone_name, county, adjacent_keys, lat, lng) VALUES
('Y35', 'Wexford Town', 'Wexford', ARRAY['Y21', 'Y25', 'X91'], 52.3369, -6.4633),
('Y21', 'Enniscorthy', 'Wexford', ARRAY['Y35', 'Y25', 'R93'], 52.5000, -6.5650),
('Y25', 'Gorey', 'Wexford', ARRAY['Y21', 'A67'], 52.6750, -6.2950)
ON CONFLICT (routing_key) DO UPDATE SET
  zone_name = EXCLUDED.zone_name,
  county = EXCLUDED.county,
  adjacent_keys = EXCLUDED.adjacent_keys,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng;

-- Carlow routing keys
INSERT INTO public.eircode_zones (routing_key, zone_name, county, adjacent_keys, lat, lng) VALUES
('R93', 'Carlow Town', 'Carlow', ARRAY['R95', 'Y21', 'R14'], 52.8408, -6.9261),
('R14', 'Tullow', 'Carlow', ARRAY['R93', 'R95', 'A67'], 52.8000, -6.7350)
ON CONFLICT (routing_key) DO UPDATE SET
  zone_name = EXCLUDED.zone_name,
  county = EXCLUDED.county,
  adjacent_keys = EXCLUDED.adjacent_keys,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng;

-- Wicklow routing keys
INSERT INTO public.eircode_zones (routing_key, zone_name, county, adjacent_keys, lat, lng) VALUES
('A67', 'Wicklow Town', 'Wicklow', ARRAY['A98', 'Y25', 'R14'], 52.9808, -6.0448),
('W91', 'Blessington', 'Wicklow', ARRAY['A67', 'W23', 'R51'], 53.1700, -6.5350)
ON CONFLICT (routing_key) DO UPDATE SET
  zone_name = EXCLUDED.zone_name,
  county = EXCLUDED.county,
  adjacent_keys = EXCLUDED.adjacent_keys,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng;

-- Kildare routing keys
INSERT INTO public.eircode_zones (routing_key, zone_name, county, adjacent_keys, lat, lng) VALUES
('W23', 'Naas', 'Kildare', ARRAY['W12', 'W91', 'K78', 'R51'], 53.2200, -6.6600),
('W12', 'Newbridge', 'Kildare', ARRAY['W23', 'R51', 'R42'], 53.1800, -6.7950),
('R51', 'Kildare Town', 'Kildare', ARRAY['W12', 'W23', 'R42'], 53.1550, -6.9100)
ON CONFLICT (routing_key) DO UPDATE SET
  zone_name = EXCLUDED.zone_name,
  county = EXCLUDED.county,
  adjacent_keys = EXCLUDED.adjacent_keys,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng;

-- Laois routing keys
INSERT INTO public.eircode_zones (routing_key, zone_name, county, adjacent_keys, lat, lng) VALUES
('R32', 'Portlaoise', 'Laois', ARRAY['R42', 'R51', 'R35'], 53.0343, -7.2993),
('R42', 'Portarlington', 'Laois', ARRAY['R32', 'R51', 'E53', 'R35'], 53.1650, -7.1900)
ON CONFLICT (routing_key) DO UPDATE SET
  zone_name = EXCLUDED.zone_name,
  county = EXCLUDED.county,
  adjacent_keys = EXCLUDED.adjacent_keys,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng;

-- Offaly routing keys
INSERT INTO public.eircode_zones (routing_key, zone_name, county, adjacent_keys, lat, lng) VALUES
('R35', 'Tullamore', 'Offaly', ARRAY['R32', 'R42', 'N37'], 53.2750, -7.4900),
('N62', 'Birr', 'Offaly', ARRAY['R35', 'E25', 'N37'], 53.0950, -7.9150)
ON CONFLICT (routing_key) DO UPDATE SET
  zone_name = EXCLUDED.zone_name,
  county = EXCLUDED.county,
  adjacent_keys = EXCLUDED.adjacent_keys,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng;

-- Westmeath routing keys
INSERT INTO public.eircode_zones (routing_key, zone_name, county, adjacent_keys, lat, lng) VALUES
('N37', 'Athlone', 'Westmeath', ARRAY['R35', 'H65', 'N39', 'N62'], 53.4228, -7.9407),
('N91', 'Mullingar', 'Westmeath', ARRAY['N37', 'N39', 'C15'], 53.5264, -7.3378),
('N39', 'Moate', 'Westmeath', ARRAY['N37', 'N91', 'R35'], 53.4550, -7.7200)
ON CONFLICT (routing_key) DO UPDATE SET
  zone_name = EXCLUDED.zone_name,
  county = EXCLUDED.county,
  adjacent_keys = EXCLUDED.adjacent_keys,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng;

-- Longford routing keys
INSERT INTO public.eircode_zones (routing_key, zone_name, county, adjacent_keys, lat, lng) VALUES
('N39', 'Longford Town', 'Longford', ARRAY['N91', 'N41', 'H16'], 53.7275, -7.7986)
ON CONFLICT (routing_key) DO UPDATE SET
  zone_name = EXCLUDED.zone_name,
  county = EXCLUDED.county,
  adjacent_keys = EXCLUDED.adjacent_keys,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng;

-- Roscommon routing keys
INSERT INTO public.eircode_zones (routing_key, zone_name, county, adjacent_keys, lat, lng) VALUES
('F42', 'Roscommon Town', 'Roscommon', ARRAY['N37', 'H54', 'F45', 'N41'], 53.6313, -8.1895),
('F45', 'Castlerea', 'Roscommon', ARRAY['F42', 'H54', 'F52'], 53.7700, -8.4900)
ON CONFLICT (routing_key) DO UPDATE SET
  zone_name = EXCLUDED.zone_name,
  county = EXCLUDED.county,
  adjacent_keys = EXCLUDED.adjacent_keys,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng;

-- Mayo routing keys
INSERT INTO public.eircode_zones (routing_key, zone_name, county, adjacent_keys, lat, lng) VALUES
('F23', 'Castlebar', 'Mayo', ARRAY['F26', 'F28', 'F52'], 53.8600, -9.3000),
('F26', 'Westport', 'Mayo', ARRAY['F23', 'F28'], 53.8000, -9.5200),
('F28', 'Ballina', 'Mayo', ARRAY['F23', 'F26', 'F91'], 54.1150, -9.1550),
('F52', 'Claremorris', 'Mayo', ARRAY['F23', 'F45', 'H54'], 53.7200, -8.9850)
ON CONFLICT (routing_key) DO UPDATE SET
  zone_name = EXCLUDED.zone_name,
  county = EXCLUDED.county,
  adjacent_keys = EXCLUDED.adjacent_keys,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng;

-- Sligo routing keys
INSERT INTO public.eircode_zones (routing_key, zone_name, county, adjacent_keys, lat, lng) VALUES
('F91', 'Sligo Town', 'Sligo', ARRAY['F92', 'F26', 'F28'], 54.2766, -8.4761),
('F92', 'Collooney', 'Sligo', ARRAY['F91', 'F52'], 54.1850, -8.4900)
ON CONFLICT (routing_key) DO UPDATE SET
  zone_name = EXCLUDED.zone_name,
  county = EXCLUDED.county,
  adjacent_keys = EXCLUDED.adjacent_keys,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng;

-- Leitrim routing keys
INSERT INTO public.eircode_zones (routing_key, zone_name, county, adjacent_keys, lat, lng) VALUES
('N41', 'Carrick-on-Shannon', 'Leitrim', ARRAY['F42', 'H16', 'F91'], 53.9472, -8.0903)
ON CONFLICT (routing_key) DO UPDATE SET
  zone_name = EXCLUDED.zone_name,
  county = EXCLUDED.county,
  adjacent_keys = EXCLUDED.adjacent_keys,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng;

-- Cavan routing keys
INSERT INTO public.eircode_zones (routing_key, zone_name, county, adjacent_keys, lat, lng) VALUES
('H12', 'Cavan Town', 'Cavan', ARRAY['H16', 'A82', 'C15'], 53.9911, -7.3606),
('H16', 'Belturbet', 'Cavan', ARRAY['H12', 'N41'], 54.1050, -7.4450)
ON CONFLICT (routing_key) DO UPDATE SET
  zone_name = EXCLUDED.zone_name,
  county = EXCLUDED.county,
  adjacent_keys = EXCLUDED.adjacent_keys,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng;

-- Monaghan routing keys
INSERT INTO public.eircode_zones (routing_key, zone_name, county, adjacent_keys, lat, lng) VALUES
('A75', 'Monaghan Town', 'Monaghan', ARRAY['H12', 'A82'], 54.2492, -6.9683),
('A82', 'Castleblayney', 'Monaghan', ARRAY['A75', 'H12', 'A91'], 54.1200, -6.7350)
ON CONFLICT (routing_key) DO UPDATE SET
  zone_name = EXCLUDED.zone_name,
  county = EXCLUDED.county,
  adjacent_keys = EXCLUDED.adjacent_keys,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng;

-- Louth routing keys
INSERT INTO public.eircode_zones (routing_key, zone_name, county, adjacent_keys, lat, lng) VALUES
('A91', 'Dundalk', 'Louth', ARRAY['A82', 'A92'], 54.0038, -6.4057),
('A92', 'Drogheda', 'Louth', ARRAY['A91', 'C15', 'K32'], 53.7179, -6.3561)
ON CONFLICT (routing_key) DO UPDATE SET
  zone_name = EXCLUDED.zone_name,
  county = EXCLUDED.county,
  adjacent_keys = EXCLUDED.adjacent_keys,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng;

-- Meath routing keys
INSERT INTO public.eircode_zones (routing_key, zone_name, county, adjacent_keys, lat, lng) VALUES
('C15', 'Navan', 'Meath', ARRAY['A92', 'H12', 'N91', 'K32'], 53.6529, -6.6812)
ON CONFLICT (routing_key) DO UPDATE SET
  zone_name = EXCLUDED.zone_name,
  county = EXCLUDED.county,
  adjacent_keys = EXCLUDED.adjacent_keys,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng;

-- Donegal routing keys
INSERT INTO public.eircode_zones (routing_key, zone_name, county, adjacent_keys, lat, lng) VALUES
('F93', 'Letterkenny', 'Donegal', ARRAY['F94', 'F92'], 54.9533, -7.7342),
('F94', 'Donegal Town', 'Donegal', ARRAY['F93', 'F91'], 54.6549, -8.1101)
ON CONFLICT (routing_key) DO UPDATE SET
  zone_name = EXCLUDED.zone_name,
  county = EXCLUDED.county,
  adjacent_keys = EXCLUDED.adjacent_keys,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng;

-- Refresh the materialized view after seeding
REFRESH MATERIALIZED VIEW public.customer_order_patterns;
