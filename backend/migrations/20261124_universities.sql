-- ============================================================
-- Migration: 20261124_universities
-- Creates the universities reference table and seeds a proper
-- full list of global (with African-first) universities so the
-- profile/signup campus picker is served from an API instead of
-- hardcoded arrays in the frontend.
-- ============================================================

CREATE TABLE IF NOT EXISTS universities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  country VARCHAR(100) NOT NULL,
  state VARCHAR(100) NULL DEFAULT NULL,
  city VARCHAR(100) NULL DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY idx_universities_name (name(191)),
  INDEX idx_name (name(191)),
  INDEX idx_country (country),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed: global university list (African-first, then worldwide).
-- INSERT IGNORE so re-running the migration is safe (dedupes on name).
INSERT IGNORE INTO universities (name, country, state, city, is_active) VALUES
-- Kenya
('University of Nairobi','Kenya','Nairobi','Nairobi',1),
('Kenyatta University','Kenya','Nairobi','Nairobi',1),
('Moi University','Kenya','Uasin Gishu','Eldoret',1),
('Egerton University','Kenya','Nakuru','Njoro',1),
('Jomo Kenyatta University of Agriculture and Technology','Kenya','Kiambu','Juja',1),
('Maseno University','Kenya','Kisumu','Maseno',1),
('Karatina University','Kenya','Nyeri','Karatina',1),
('Chuka University','Kenya','Tharaka-Nithi','Chuka',1),
('Dedan Kimathi University of Technology','Kenya','Nyeri','Nyeri',1),
('Multimedia University of Kenya','Kenya','Nairobi','Nairobi',1),
('Technical University of Kenya','Kenya','Nairobi','Nairobi',1),
('Murang\'a University of Technology','Kenya','Murang\'a','Murang\'a',1),
('Pwani University','Kenya','Kilifi','Kilifi',1),
('Masinde Muliro University of Science and Technology','Kenya','Kakamega','Kakamega',1),
('Kisii University','Kenya','Kisii','Kisii',1),
('University of Eldoret','Kenya','Uasin Gishu','Eldoret',1),
('Laikipia University','Kenya','Laikipia','Nyahururu',1),
('South Eastern Kenya University','Kenya','Kitui','Kitui',1),
('Technical University of Mombasa','Kenya','Mombasa','Mombasa',1),
('Kenya Methodist University','Kenya','Meru','Meru',1),
('Daystar University','Kenya','Nairobi','Nairobi',1),
('United States International University-Africa','Kenya','Nairobi','Nairobi',1),
('Strathmore University','Kenya','Nairobi','Nairobi',1),
('Aga Khan University','Kenya','Nairobi','Nairobi',1),
-- Nigeria
('University of Ibadan','Nigeria','Oyo','Ibadan',1),
('University of Nigeria','Nigeria','Enugu','Nsukka',1),
('Obafemi Awolowo University','Nigeria','Osun','Ile-Ife',1),
('University of Lagos','Nigeria','Lagos','Lagos',1),
('Ahmadu Bello University','Nigeria','Kaduna','Zaria',1),
('University of Benin','Nigeria','Edo','Benin City',1),
('University of Port Harcourt','Nigeria','Rivers','Port Harcourt',1),
('Bayero University Kano','Nigeria','Kano','Kano',1),
('University of Ilorin','Nigeria','Kwara','Ilorin',1),
('Federal University of Technology Akure','Nigeria','Ondo','Akure',1),
('Federal University of Technology Minna','Nigeria','Niger','Minna',1),
('University of Abuja','Nigeria','FCT','Abuja',1),
('Nnamdi Azikiwe University','Nigeria','Anambra','Awka',1),
('University of Jos','Nigeria','Plateau','Jos',1),
('University of Calabar','Nigeria','Cross River','Calabar',1),
('Usmanu Danfodiyo University','Nigeria','Sokoto','Sokoto',1),
('University of Maiduguri','Nigeria','Borno','Maiduguri',1),
('Federal University of Technology Owerri','Nigeria','Imo','Owerri',1),
('Lagos State University','Nigeria','Lagos','Lagos',1),
('Covenant University','Nigeria','Ogun','Ota',1),
-- South Africa
('University of Cape Town','South Africa','Western Cape','Cape Town',1),
('University of the Witwatersrand','South Africa','Gauteng','Johannesburg',1),
('Stellenbosch University','South Africa','Western Cape','Stellenbosch',1),
('University of KwaZulu-Natal','South Africa','KwaZulu-Natal','Durban',1),
('University of Pretoria','South Africa','Gauteng','Pretoria',1),
('University of Johannesburg','South Africa','Gauteng','Johannesburg',1),
('University of the Western Cape','South Africa','Western Cape','Cape Town',1),
('North-West University','South Africa','North West','Potchefstroom',1),
('Rhodes University','South Africa','Eastern Cape','Grahamstown',1),
('University of the Free State','South Africa','Free State','Bloemfontein',1),
-- Ghana
('University of Ghana','Ghana','Greater Accra','Legon',1),
('Kwame Nkrumah University of Science and Technology','Ghana','Ashanti','Kumasi',1),
('University of Cape Coast','Ghana','Central','Cape Coast',1),
('University for Development Studies','Ghana','Northern','Tamale',1),
('University of Education Winneba','Ghana','Central','Winneba',1),
-- Egypt
('Cairo University','Egypt','Cairo','Giza',1),
('Alexandria University','Egypt','Alexandria','Alexandria',1),
('Ain Shams University','Egypt','Cairo','Cairo',1),
('American University in Cairo','Egypt','Cairo','Cairo',1),
-- Uganda
('Makerere University','Uganda','Central','Kampala',1),
('Uganda Martyrs University','Uganda','Central','Nkozi',1),
-- Tanzania
('University of Dar es Salaam','Tanzania','Dar es Salaam','Dar es Salaam',1),
('Sokoine University of Agriculture','Tanzania','Morogoro','Morogoro',1),
-- Rwanda
('University of Rwanda','Rwanda','Kigali','Kigali',1),
-- Ethiopia
('Addis Ababa University','Ethiopia','Addis Ababa','Addis Ababa',1),
-- Zimbabwe
('University of Zimbabwe','Zimbabwe','Harare','Harare',1),
-- United States
('Harvard University','United States','Massachusetts','Cambridge',1),
('Stanford University','United States','California','Stanford',1),
('Massachusetts Institute of Technology','United States','Massachusetts','Cambridge',1),
('University of California Berkeley','United States','California','Berkeley',1),
('University of California Los Angeles','United States','California','Los Angeles',1),
('Yale University','United States','Connecticut','New Haven',1),
('Princeton University','United States','New Jersey','Princeton',1),
('Columbia University','United States','New York','New York',1),
('University of Chicago','United States','Illinois','Chicago',1),
('University of Pennsylvania','United States','Pennsylvania','Philadelphia',1),
('Cornell University','United States','New York','Ithaca',1),
('Johns Hopkins University','United States','Maryland','Baltimore',1),
('University of Michigan','United States','Michigan','Ann Arbor',1),
('Northwestern University','United States','Illinois','Evanston',1),
('Duke University','United States','North Carolina','Durham',1),
('University of Southern California','United States','California','Los Angeles',1),
('New York University','United States','New York','New York',1),
('Georgia Institute of Technology','United States','Georgia','Atlanta',1),
('University of Texas at Austin','United States','Texas','Austin',1),
('University of Washington','United States','Washington','Seattle',1),
('University of Wisconsin-Madison','United States','Wisconsin','Madison',1),
-- United Kingdom
('University of Oxford','United Kingdom','Oxfordshire','Oxford',1),
('University of Cambridge','United Kingdom','Cambridgeshire','Cambridge',1),
('Imperial College London','United Kingdom','England','London',1),
('London School of Economics','United Kingdom','England','London',1),
('University College London','United Kingdom','England','London',1),
('University of Edinburgh','United Kingdom','Scotland','Edinburgh',1),
('University of Manchester','United Kingdom','England','Manchester',1),
("King's College London","United Kingdom",'England','London',1),
('University of Bristol','United Kingdom','England','Bristol',1),
('University of Warwick','United Kingdom','England','Coventry',1),
-- Canada
('University of Toronto','Canada','Ontario','Toronto',1),
('University of British Columbia','Canada','British Columbia','Vancouver',1),
('McGill University','Canada','Quebec','Montreal',1),
('University of Alberta','Canada','Alberta','Edmonton',1),
('McMaster University','Canada','Ontario','Hamilton',1),
('University of Waterloo','Canada','Ontario','Waterloo',1),
('Western University','Canada','Ontario','London',1),
('Queen\'s University','Canada','Ontario','Kingston',1),
-- Australia
('University of Melbourne','Australia','Victoria','Melbourne',1),
('University of Sydney','Australia','New South Wales','Sydney',1),
('Australian National University','Australia','Australian Capital Territory','Canberra',1),
('University of Queensland','Australia','Queensland','Brisbane',1),
('Monash University','Australia','Victoria','Clayton',1),
('University of New South Wales','Australia','New South Wales','Sydney',1),
-- India
('Indian Institute of Technology Bombay','India','Maharashtra','Mumbai',1),
('Indian Institute of Technology Delhi','India','Delhi','New Delhi',1),
('University of Delhi','India','Delhi','New Delhi',1),
('Indian Institute of Science','India','Karnataka','Bangalore',1),
('University of Mumbai','India','Maharashtra','Mumbai',1),
('University of Calcutta','India','West Bengal','Kolkata',1),
-- Pakistan
('University of the Punjab','Pakistan','Punjab','Lahore',1),
('Lahore University of Management Sciences','Pakistan','Punjab','Lahore',1),
('University of Karachi','Pakistan','Sindh','Karachi',1),
-- Bangladesh
('University of Dhaka','Bangladesh','Dhaka','Dhaka',1),
('Bangladesh University of Engineering and Technology','Bangladesh','Dhaka','Dhaka',1),
-- Germany
('Ludwig Maximilian University of Munich','Germany','Bavaria','Munich',1),
('Technical University of Munich','Germany','Bavaria','Munich',1),
('Heidelberg University','Germany','Baden-Württemberg','Heidelberg',1),
-- France
('University of Paris','France','Île-de-France','Paris',1),
('Sorbonne University','France','Île-de-France','Paris',1),
('École Polytechnique','France','Île-de-France','Palaiseau',1),
-- China
('Peking University','China','Beijing','Beijing',1),
('Tsinghua University','China','Beijing','Beijing',1),
('Fudan University','China','Shanghai','Shanghai',1),
-- Japan
('University of Tokyo','Japan','Tokyo','Tokyo',1),
('Kyoto University','Japan','Kyoto','Kyoto',1),
-- Brazil
('University of São Paulo','Brazil','São Paulo','São Paulo',1),
('University of Campinas','Brazil','São Paulo','Campinas',1),
-- Mexico
('National Autonomous University of Mexico','Mexico','Mexico City','Mexico City',1),
-- New Zealand
('University of Auckland','New Zealand','Auckland','Auckland',1),
('University of Otago','New Zealand','Otago','Dunedin',1),
-- Ireland
('Trinity College Dublin','Ireland','Dublin','Dublin',1),
('University College Dublin','Ireland','Dublin','Dublin',1),
-- Netherlands
('University of Amsterdam','Netherlands','North Holland','Amsterdam',1),
('Delft University of Technology','Netherlands','South Holland','Delft',1),
-- Switzerland
('ETH Zurich','Switzerland','Zurich','Zurich',1),
('University of Zurich','Switzerland','Zurich','Zurich',1),
-- Spain
('University of Barcelona','Spain','Catalonia','Barcelona',1),
('Autonomous University of Madrid','Spain','Community of Madrid','Madrid',1),
-- Italy
('University of Bologna','Italy','Emilia-Romagna','Bologna',1),
('Sapienza University of Rome','Italy','Lazio','Rome',1),
-- Sweden
('Uppsala University','Sweden','Uppsala','Uppsala',1),
('Lund University','Sweden','Skåne','Lund',1),
-- Singapore
('National University of Singapore','Singapore','','Singapore',1),
('Nanyang Technological University','Singapore','','Singapore',1),
-- Hong Kong
('University of Hong Kong','Hong Kong','','Hong Kong',1),
('Chinese University of Hong Kong','Hong Kong','','Hong Kong',1),
-- Saudi Arabia
('King Abdulaziz University','Saudi Arabia','Makkah','Jeddah',1),
('King Fahd University of Petroleum and Minerals','Saudi Arabia','Eastern','Dhahran',1),
-- United Arab Emirates
('United Arab Emirates University','United Arab Emirates','Abu Dhabi','Al Ain',1),
-- Malaysia
('University of Malaya','Malaysia','Kuala Lumpur','Kuala Lumpur',1),
-- Indonesia
('University of Indonesia','Indonesia','Jakarta','Depok',1),
-- Philippines
('University of the Philippines','Philippines','Quezon City','Quezon City',1),
-- Thailand
('Chulalongkorn University','Thailand','Bangkok','Bangkok',1),
-- South Korea
('Seoul National University','South Korea','Seoul','Seoul',1),
('Korea Advanced Institute of Science and Technology','South Korea','Daejeon','Daejeon',1),
-- Turkey
('Middle East Technical University','Turkey','Ankara','Ankara',1),
('Boğaziçi University','Turkey','Istanbul','Istanbul',1),
-- Poland
('University of Warsaw','Poland','Masovia','Warsaw',1),
-- Czech Republic
('Charles University','Czech Republic','Prague','Prague',1),
-- Argentina
('University of Buenos Aires','Argentina','Buenos Aires','Buenos Aires',1),
-- Chile
('University of Chile','Chile','Santiago','Santiago',1);
