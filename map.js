    const themeStorageKey = 'osm-map-theme';
    const systemThemePreference = window.matchMedia('(prefers-color-scheme: dark)');
    let selectedTheme = 'system';
    function applyTheme() {
      document.documentElement.dataset.theme = selectedTheme === 'system'
        ? (systemThemePreference.matches ? 'dark' : 'light')
        : selectedTheme;
      setBaseLayer(activeBaseLayerName);
    }

    function handleSystemThemeChange() {
      if (selectedTheme === 'system') {
        applyTheme();
        recordActivity('map_style', { style: activeBaseLayerName, theme: 'system' });
      }
    }

    function initializeThemeSelector() {
      const themeSelect = document.getElementById('theme-select');
      try {
        const savedTheme = window.localStorage.getItem(themeStorageKey);
        if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
          selectedTheme = savedTheme;
        }
      } catch (error) {
        console.warn('Could not load the saved theme preference:', error);
      }
      themeSelect.value = selectedTheme;
      themeSelect.addEventListener('change', function () {
        selectedTheme = themeSelect.value;
        applyTheme();
        recordActivity('map_style', { style: activeBaseLayerName, theme: selectedTheme });
        try {
          window.localStorage.setItem(themeStorageKey, selectedTheme);
        } catch (error) {
          console.warn('Could not save the theme preference:', error);
        }
      });
      if (systemThemePreference.addEventListener) {
        systemThemePreference.addEventListener('change', handleSystemThemeChange);
      } else if (systemThemePreference.addListener) {
        systemThemePreference.addListener(handleSystemThemeChange);
      }
      applyTheme();
    }

    const routingConfig = window.OSM_MAP_ROUTING_CONFIG || {};
    const esriTrafficApiKey = typeof routingConfig.esriApiKey === 'string'
      ? routingConfig.esriApiKey.trim()
      : '';
    const map = L.map('map', { zoomControl: false, maxZoom: 22 }).setView([10.6896476, 122.4824483], 14);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    map.createPane('routePane');
    map.getPane('routePane').style.zIndex = '650';
    map.getPane('routePane').style.pointerEvents = 'auto';
    const initialCenter = [map.getCenter().lng, map.getCenter().lat];
    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxNativeZoom: 18,
      maxZoom: 22,
      attribution: 'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
    }).addTo(map);
    const terrainLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxNativeZoom: 17,
      maxZoom: 22,
      attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)'
    });
    const topographicLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
      maxNativeZoom: 17,
      maxZoom: 22,
      attribution: 'Tiles &copy; Esri and its data providers'
    });
    const reliefLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}', {
      maxNativeZoom: 13,
      maxZoom: 22,
      attribution: 'Tiles &copy; Esri, USGS, NOAA'
    });
    const placeLabelsLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
      maxNativeZoom: 18,
      maxZoom: 22,
      pane: 'overlayPane',
      attribution: 'Labels &copy; Esri'
    }).addTo(map);
    const serviceGroups = {
      healthHospitals: L.layerGroup().addTo(map),
      healthClinics: L.layerGroup().addTo(map),
      healthCare: L.layerGroup().addTo(map),
      healthMentalHealth: L.layerGroup().addTo(map),
      healthOther: L.layerGroup().addTo(map),
      emergencyAmbulance: L.layerGroup().addTo(map),
      emergencyPolice: L.layerGroup().addTo(map),
      emergencyFire: L.layerGroup().addTo(map),
      emergencyResponders: L.layerGroup().addTo(map)
    };
    const serviceSymbols = {
      hospital: '✚', clinic: '✚', healthcare_centre: '✚', health_post: '✚',
      doctors: '⚕', doctor: '⚕', nurse: '⚕', midwife: '⚕', physiotherapist: '⚕',
      dentist: '✣', pharmacy: 'Rx', veterinary: '♧', nursing_home: '♿',
      social_facility: '♿', vaccination_centre: '✚', blood_donation: '♥',
      rehabilitation: '♿', mental_health: '☻', laboratory: '⚗', hospice: '✚',
      ambulance_station: 'A', fire_station: 'F', fire_service: 'F',
      police: 'P', rescue_station: 'R', rescue_service: 'R', lifeguard: 'R',
      medical_supply: '⚕', medical_equipment: '⚕'
    };
    const serviceCategoryGroups = {
      healthHospitals: ['hospital'],
      healthClinics: ['clinic', 'healthcare_centre', 'health_post', 'urgent_care', 'birthing_centre'],
      healthCare: [
        'nursing_home', 'social_facility', 'rehabilitation', 'hospice', 'healthcare',
        'veterinary', 'vaccination_centre', 'blood_donation', 'dialysis',
        'doctors', 'doctor', 'dentist', 'nurse', 'midwife', 'physiotherapist',
        'podiatrist', 'optometrist', 'audiologist', 'occupational_therapist',
        'speech_therapist'
      ],
      healthMentalHealth: ['mental_health', 'psychotherapist'],
      healthOther: [
        'pharmacy', 'laboratory', 'sample_collection', 'blood_testing',
        'medical_supply', 'medical_equipment', 'orthopaedic'
      ],
      emergencyAmbulance: ['ambulance_station'],
      emergencyPolice: ['police'],
      emergencyFire: ['fire_station', 'fire_service'],
      emergencyResponders: [
        'rescue_station', 'rescue_service', 'lifeguard', 'disaster_response',
        'disaster_response_centre', 'civil_protection', 'emergency_response',
        'emergency_services', 'emergency', 'rescue'
      ]
    };
    const serviceCategoryLabels = {
      healthHospitals: 'Hospitals',
      healthClinics: 'Clinics & Health Centers',
      healthCare: 'Nursing, Care & Other health',
      healthMentalHealth: 'Mental Health Services',
      healthOther: 'Other Health Services',
      emergencyAmbulance: 'Ambulance / Stations',
      emergencyPolice: 'Police Car / Stations',
      emergencyFire: 'Fire Truck / Stations',
      emergencyResponders: 'Emergency Responders / Rescue'
    };
    const serviceCategoryGroupByValue = {};
    Object.keys(serviceCategoryGroups).forEach(function (groupName) {
      serviceCategoryGroups[groupName].forEach(function (value) {
        serviceCategoryGroupByValue[value] = groupName;
      });
    });
    const serviceCategoryFilters = [
      'osm.amenity.hospital', 'osm.amenity.clinic', 'osm.amenity.doctors',
      'osm.amenity.dentist', 'osm.amenity.pharmacy', 'osm.amenity.veterinary',
      'osm.amenity.nursing_home', 'osm.amenity.social_facility',
      'osm.amenity.ambulance_station', 'osm.amenity.fire_station',
      'osm.amenity.police', 'osm.healthcare.hospital',
      'osm.healthcare.clinic', 'osm.healthcare.doctor', 'osm.healthcare.dentist',
      'osm.healthcare.pharmacy', 'osm.healthcare.physiotherapist',
      'osm.healthcare.nurse', 'osm.healthcare.midwife',
      'osm.healthcare.healthcare_centre', 'osm.healthcare.health_post',
      'osm.healthcare.blood_donation', 'osm.healthcare.vaccination_centre',
      'osm.healthcare.rehabilitation', 'osm.healthcare.mental_health',
      'osm.healthcare.laboratory', 'osm.healthcare.hospice',
      'osm.healthcare.urgent_care', 'osm.healthcare.birthing_centre',
      'osm.healthcare.dialysis', 'osm.healthcare.orthopaedic',
      'osm.healthcare.optometrist', 'osm.healthcare.audiologist',
      'osm.healthcare.podiatrist', 'osm.healthcare.psychotherapist',
      'osm.healthcare.occupational_therapist', 'osm.healthcare.speech_therapist',
      'osm.healthcare.sample_collection',
      'osm.shop.medical_supply', 'osm.shop.medical_equipment', 'osm.shop.orthopaedic',
      'osm.emergency.ambulance_station', 'osm.emergency.fire_service',
      'osm.emergency.police', 'osm.emergency.rescue_station',
      'osm.emergency.fire_station', 'osm.emergency.rescue_service',
      'osm.emergency.lifeguard', 'osm.emergency.rescue',
      'osm.emergency.emergency_response', 'osm.emergency.emergency_services',
      'osm.emergency.disaster_response',
      'osm.emergency.civil_protection',
      'osm.office.emergency', 'osm.office.disaster_response',
      'osm.office.civil_protection', 'osm.office.emergency_services'
    ];
    const emergencyRouteFilters = {
      ambulance: [
        'osm.amenity.hospital', 'osm.healthcare.hospital',
        'osm.amenity.clinic', 'osm.healthcare.clinic',
        'osm.amenity.ambulance_station', 'osm.emergency.ambulance_station'
      ],
      responder: [
        'osm.emergency.rescue_station', 'osm.emergency.rescue_service', 'osm.emergency.rescue',
        'osm.emergency.lifeguard', 'osm.emergency.disaster_response',
        'osm.emergency.civil_protection', 'osm.emergency.emergency_response',
        'osm.emergency.emergency_services', 'osm.office.emergency',
        'osm.office.emergency_services', 'osm.office.disaster_response',
        'osm.office.civil_protection'
      ],
      police: ['osm.amenity.police', 'osm.emergency.police'],
      fire: [
        'osm.amenity.fire_station', 'osm.emergency.fire_station', 'osm.emergency.fire_service'
      ]
    };
    const emergencyServiceFilters = Object.keys(emergencyRouteFilters).reduce(
      function (filters, type) {
        return filters.concat(emergencyRouteFilters[type]);
      },
      []
    );
    const KNOWN_EMERGENCY_FACILITIES = [
      // Ambulance / Hospitals with Doctor Specialization Departments
      {
        name: "Western Visayas Medical Center (WVMC)",
        type: "ambulance",
        category: "Tertiary Government Hospital / Ambulance Base",
        coordinates: [122.5342, 10.7188],
        address: "Q. Abeto St, Mandurriao, Iloilo City",
        phone: "(033) 321-2841",
        specializations: ['pedia', 'cardio', 'ent', 'obgyn', 'ortho', 'neuro', 'pulmo', 'ophthal', 'derma', 'gastro', 'nephro', 'surgery'],
        specialtyNotes: {
          pedia: "24/7 Pediatric Emergency Room, Neonatal Intensive Care Unit (NICU), Pediatric Subspecialties",
          cardio: "Cardiac Care Unit (CCU), 24/7 Acute Coronary Triage & Interventional Cardiology",
          ent: "Department of Otorhinolaryngology - Head and Neck Surgery (Foreign body extraction, airway emergencies)",
          obgyn: "Comprehensive Emergency Obstetric & Newborn Care (CEmONC), High-Risk Pregnancy Center",
          ortho: "Trauma & Orthopedic Surgery, Acute Fracture Stabilization & Bone Joint Reconstruction",
          neuro: "Acute Stroke Unit, Neurosurgery & Neurological Intensive Care",
          pulmo: "Pulmonary Critical Care Unit, Respiratory Therapy & Acute Asthma Interventions",
          ophthal: "Ophthalmology Eye Center, Eye Trauma & Ocular Emergency Treatment",
          derma: "Dermatology Emergency & Acute Skin Lesion/Burn Consultation",
          gastro: "Digestive Health & Endoscopy Unit, GI Bleeding Interventions",
          nephro: "Nephrology & 24/7 Hemodialysis Unit, Acute Renal Failure Care",
          surgery: "General & Advanced Trauma Surgery, 24/7 Operating Theatres"
        }
      },
      {
        name: "Iloilo Doctors' Hospital",
        type: "ambulance",
        category: "Private Hospital / 24/7 Ambulance Service",
        coordinates: [122.5489, 10.7001],
        address: "West Timawa, Molo, Iloilo City",
        phone: "(033) 337-7702",
        specializations: ['pedia', 'cardio', 'ent', 'obgyn', 'ortho', 'nephro', 'ophthal', 'surgery'],
        specialtyNotes: {
          pedia: "Department of Pediatrics, Well & Sick Baby Nurseries, Pediatric Emergency",
          cardio: "Heart Station, Electrocardiography & Cardiovascular Evaluations",
          ent: "ENT-HNS Clinic, Otolaryngology & Sinus Emergency Management",
          obgyn: "Obstetrics & Gynecology Center, Labor & Delivery Suites",
          ortho: "Bone & Joint Fracture Clinic, Orthopedic Surgery & Cast Application",
          nephro: "Renal Center & Hemodialysis Services",
          ophthal: "Ophthalmology Consultation & Eye Care Clinic",
          surgery: "General Surgery, Emergency Abdominal Operations & Wound Debridement"
        }
      },
      {
        name: "QualiMed Hospital Iloilo",
        type: "ambulance",
        category: "General Hospital / Ambulance Service",
        coordinates: [122.5475, 10.7102],
        address: "Atria Park District, San Rafael, Mandurriao, Iloilo City",
        phone: "(033) 501-4848",
        specializations: ['pedia', 'cardio', 'obgyn', 'ortho', 'surgery'],
        specialtyNotes: {
          pedia: "Pediatric Clinic & Emergency Triage, Well Baby Care",
          cardio: "Cardiology Diagnostics & Outpatient Heart Clinic",
          obgyn: "Maternal Health, Prenatal & Delivery Services",
          ortho: "Orthopedics & Fracture Casting Clinic",
          surgery: "General Surgery & Emergency Trauma Stabilization"
        }
      },
      {
        name: "St. Paul's Hospital Iloilo",
        type: "ambulance",
        category: "Level 3 Hospital / 24/7 Emergency & Ambulance",
        coordinates: [122.5647, 10.6975],
        address: "General Luna St, City Proper, Iloilo City",
        phone: "(033) 337-2741",
        specializations: ['pedia', 'cardio', 'ent', 'obgyn', 'ortho', 'neuro', 'pulmo', 'ophthal', 'gastro', 'surgery'],
        specialtyNotes: {
          pedia: "Pediatric Emergency Ward, Child Health Specialists & Neonatology",
          cardio: "Heart Station, Non-Invasive Cardiovascular Lab, Echocardiography & Stress Testing",
          ent: "Hearing & Balance Center, Ear-Nose-Throat Emergency Consultation",
          obgyn: "Maternity & Delivery Complex, Women's Health & Gynecologic Surgery",
          ortho: "Orthopedic Surgery, Fracture Care & Musculoskeletal Rehabilitation",
          neuro: "Neurology Clinic & Neurological Emergency Triage",
          pulmo: "Pulmonary Medicine & Respiratory Care Services",
          ophthal: "St. Paul's Eye Clinic & Comprehensive Vision Diagnostics",
          gastro: "Gastroenterology & Digestive Endoscopy Center",
          surgery: "General Surgery, Surgical Intensive Care & Trauma Care"
        }
      },
      {
        name: "The Medical City Iloilo",
        type: "ambulance",
        category: "Tertiary Hospital / Emergency Ambulance",
        coordinates: [122.5412, 10.6953],
        address: "Locsin St, Tap-oc, Molo, Iloilo City",
        phone: "(033) 500-1000",
        specializations: ['cardio', 'pedia', 'neuro', 'gastro', 'pulmo', 'ortho', 'ent', 'surgery'],
        specialtyNotes: {
          cardio: "Cardiovascular Center & Cardiac Catheterization Lab (Cath Lab), Angioplasty, 24/7 CCU",
          pedia: "Pediatric Intensive Care Unit (PICU), General & Subspecialty Pediatrics",
          neuro: "Certified Acute Stroke Center, Neuro-critical Care & Advanced Brain Imaging",
          gastro: "Center for Endoscopic & Digestive Surgery, Acute GI Triage",
          pulmo: "Pulmonary Diagnostic & Respiratory Care Unit",
          ortho: "Bone & Joint Center, Sports Medicine & Joint Replacement",
          ent: "ENT Clinic, Audiology & Head/Neck Evaluation",
          surgery: "Trauma & Minimally Invasive Laparoscopic Surgery"
        }
      },
      {
        name: "Iloilo Mission Hospital",
        type: "ambulance",
        category: "Tertiary Hospital / Ambulance Service",
        coordinates: [122.5643, 10.7259],
        address: "Mission Road, Jaro, Iloilo City",
        phone: "(033) 320-0315",
        specializations: ['pedia', 'cardio', 'ent', 'obgyn', 'ortho', 'neuro', 'surgery'],
        specialtyNotes: {
          pedia: "Pediatric Department & Emergency Child Care",
          cardio: "Cardiology Station & Cardiac Monitoring",
          ent: "ENT Clinic & Hearing Diagnostic Services",
          obgyn: "Obstetrics, Labor & Delivery Ward",
          ortho: "Orthopedic Surgery & Bone Fracture Center",
          neuro: "Neurology & Neurosurgical Emergency Care",
          surgery: "General Surgery & Emergency Trauma Bays"
        }
      },
      {
        name: "Medicus Medical Center",
        type: "ambulance",
        category: "Tertiary General Hospital / Ambulance",
        coordinates: [122.5441, 10.7153],
        address: "Diversion Road, Mandurriao, Iloilo City",
        phone: "(033) 328-7777",
        specializations: ['cardio', 'ent', 'ortho', 'ophthal', 'derma', 'nephro', 'surgery'],
        specialtyNotes: {
          cardio: "Heart & Vascular Diagnostic Center, 2D Echo, Vascular Studies",
          ent: "ENT & Hearing Diagnostic Clinic",
          ortho: "Orthopedic & Physical Rehabilitation Department",
          ophthal: "Medicus Eye & Laser Center, Advanced Retinal & Ocular Diagnostics",
          derma: "Dermatology & Skin Laser Center",
          nephro: "Hemodialysis Center & Nephrology Consultation",
          surgery: "Ambulatory & Inpatient General Surgery"
        }
      },
      {
        name: "West Visayas State University Medical Center",
        type: "ambulance",
        category: "University Training Hospital / Ambulance",
        coordinates: [122.5583, 10.7176],
        address: "E. Lopez St, Jaro, Iloilo City",
        phone: "(033) 320-2431",
        specializations: ['pedia', 'cardio', 'ent', 'obgyn', 'ortho', 'neuro', 'pulmo', 'surgery'],
        specialtyNotes: {
          pedia: "University Child Health & Pediatric Critical Care, 24/7 Pediatric Ward",
          cardio: "Cardiology Service, Heart Diagnostics & CCU",
          ent: "ENT Head & Neck Surgery Clinic, Emergency Airway & Foreign Body Removal",
          obgyn: "Obstetrics & Gynecology Department, High-Risk Delivery Management",
          ortho: "Orthopedics Department, Musculoskeletal Trauma & Spine Surgery",
          neuro: "Neurology & Neurosurgery Service, Traumatic Brain Injury Care",
          pulmo: "Pulmonology & Respiratory Medicine Unit",
          surgery: "University Trauma Surgery & 24/7 Emergency Operations"
        }
      },
      {
        name: "Philippine Red Cross - Iloilo Ambulance Unit",
        type: "ambulance",
        category: "Emergency Medical & Ambulance Service",
        coordinates: [122.5641, 10.6989],
        address: "Bonifacio Drive, Iloilo City",
        phone: "(033) 337-5976"
      },
      {
        name: "Metro Iloilo Hospital and Medical Center",
        type: "ambulance",
        category: "Level 2 Hospital / Emergency Ambulance",
        coordinates: [122.5532, 10.7486],
        address: "Metropolis Ave, Jaro, Iloilo City",
        phone: "(033) 327-1527",
        specializations: ['pedia', 'cardio', 'obgyn', 'ortho', 'pulmo', 'surgery'],
        specialtyNotes: {
          pedia: "Pediatrics Ward & Newborn Nursery Care",
          cardio: "Cardiovascular Monitoring & Diagnostic Cardiology",
          obgyn: "Obstetrics & Gynecology Department, Birthing Suites",
          ortho: "Orthopedic Trauma & Bone Fracture Management",
          pulmo: "Pulmonary & Respiratory Therapy Services",
          surgery: "General Surgery & 24/7 Operating Theater"
        }
      },

      // Police
      {
        name: "Iloilo City Police Station 4 (Molo)",
        type: "police",
        category: "PNP Police Station 4",
        coordinates: [122.5458, 10.6977],
        address: "M.H. del Pilar St, Molo, Iloilo City",
        phone: "(033) 337-3011"
      },
      {
        name: "Iloilo City Police Station 5 (Mandurriao)",
        type: "police",
        category: "PNP Police Station 5",
        coordinates: [122.5368, 10.7196],
        address: "Guzman St, Mandurriao, Iloilo City",
        phone: "(033) 321-2777"
      },
      {
        name: "Iloilo City Police Station 6 (Arevalo)",
        type: "police",
        category: "PNP Police Station 6",
        coordinates: [122.5186, 10.6865],
        address: "Quezon St, Villa Arevalo, Iloilo City",
        phone: "(033) 337-8855"
      },
      {
        name: "Iloilo City Police Office (ICPO Headquarters)",
        type: "police",
        category: "Police Headquarters & Dispatch",
        coordinates: [122.5623, 10.6961],
        address: "General Luna St, City Proper, Iloilo City",
        phone: "(033) 337-0400"
      },
      {
        name: "Iloilo City Police Station 1 (City Proper)",
        type: "police",
        category: "PNP Police Station 1",
        coordinates: [122.5684, 10.6957],
        address: "Iznart St, City Proper, Iloilo City",
        phone: "(033) 337-2240"
      },
      {
        name: "Iloilo City Police Station 2 (La Paz)",
        type: "police",
        category: "PNP Police Station 2",
        coordinates: [122.5691, 10.7118],
        address: "Huervana St, La Paz, Iloilo City",
        phone: "(033) 320-0014"
      },
      {
        name: "Iloilo City Police Station 3 (Jaro)",
        type: "police",
        category: "PNP Police Station 3",
        coordinates: [122.5574, 10.7253],
        address: "E. Lopez St, Jaro, Iloilo City",
        phone: "(033) 329-5484"
      },
      {
        name: "Oton Municipal Police Station",
        type: "police",
        category: "PNP Municipal Police Station",
        coordinates: [122.4770, 10.6951],
        address: "Mabini St, Poblacion, Oton, Iloilo",
        phone: "(033) 336-1215"
      },

      // Fire Truck / Fire Service
      {
        name: "BFP Molo Sub-Fire Station",
        type: "fire",
        category: "Bureau of Fire Protection / Fire Engine Unit",
        coordinates: [122.5461, 10.6972],
        address: "Molo Plaza, Molo, Iloilo City",
        phone: "(033) 337-2299"
      },
      {
        name: "BFP Mandurriao Sub-Fire Station",
        type: "fire",
        category: "Bureau of Fire Protection / Fire Engine Unit",
        coordinates: [122.5371, 10.7192],
        address: "Mandurriao Plaza, Mandurriao, Iloilo City",
        phone: "(033) 321-0000"
      },
      {
        name: "BFP Arevalo Sub-Fire Station",
        type: "fire",
        category: "Bureau of Fire Protection / Fire Engine Unit",
        coordinates: [122.5181, 10.6862],
        address: "Villa Arevalo Plaza, Iloilo City",
        phone: "(033) 336-2244"
      },
      {
        name: "Iloilo City Central Fire Station (BFP)",
        type: "fire",
        category: "Central Fire Station & Rescue Engines",
        coordinates: [122.5712, 10.6938],
        address: "De la Rama St, City Proper, Iloilo City",
        phone: "(033) 337-4444"
      },
      {
        name: "ICAG Volunteer Fire Brigade",
        type: "fire",
        category: "Volunteer Fire Brigade & Response",
        coordinates: [122.5668, 10.6942],
        address: "Delgado St, City Proper, Iloilo City",
        phone: "(033) 337-8888"
      },
      {
        name: "Federation of Iloilo Volunteer Fire Brigade",
        type: "fire",
        category: "Volunteer Fire Brigade / Tankers & Trucks",
        coordinates: [122.5654, 10.6960],
        address: "Iznart St, City Proper, Iloilo City",
        phone: "(033) 337-3333"
      },
      {
        name: "BFP Jaro Sub-Fire Station",
        type: "fire",
        category: "Bureau of Fire Protection / Fire Engine Unit",
        coordinates: [122.5578, 10.7250],
        address: "Jaro Plaza, Jaro, Iloilo City",
        phone: "(033) 329-2233"
      },
      {
        name: "BFP La Paz Sub-Fire Station",
        type: "fire",
        category: "Bureau of Fire Protection / Fire Engine Unit",
        coordinates: [122.5689, 10.7115],
        address: "La Paz Plaza, La Paz, Iloilo City",
        phone: "(033) 320-1122"
      },
      {
        name: "Oton BFP Fire Station",
        type: "fire",
        category: "Municipal Fire Station",
        coordinates: [122.4764, 10.6948],
        address: "Poblacion South, Oton, Iloilo",
        phone: "(033) 336-0911"
      },

      // Rescue / Responder
      {
        name: "Iloilo City Emergency Operations Center (CDRRMO)",
        type: "responder",
        category: "Disaster Risk Reduction & Rescue Command",
        coordinates: [122.5705, 10.6929],
        address: "Iloilo City Hall, Plaza Libertad, Iloilo City",
        phone: "(033) 333-1111"
      },
      {
        name: "Philippine Red Cross - Iloilo Chapter",
        type: "responder",
        category: "Disaster Response & Rescue Unit",
        coordinates: [122.5641, 10.6989],
        address: "Bonifacio Drive, Iloilo City",
        phone: "(033) 337-5976"
      },
      {
        name: "Iloilo Provincial DRRMO (PDRRMO)",
        type: "responder",
        category: "Provincial Disaster Response Headquarters",
        coordinates: [122.5645, 10.6971],
        address: "Iloilo Provincial Capitol, Bonifacio Drive, Iloilo City",
        phone: "(033) 328-7900"
      },
      {
        name: "Molo District Emergency Response Unit",
        type: "responder",
        category: "Community Quick Response Team",
        coordinates: [122.5460, 10.6979],
        address: "Molo Plaza Area, Iloilo City",
        phone: "(033) 337-3011"
      },
      {
        name: "Mandurriao Disaster Response Unit",
        type: "responder",
        category: "District Emergency Response Team",
        coordinates: [122.5369, 10.7194],
        address: "Mandurriao District Office, Iloilo City",
        phone: "(033) 321-2777"
      },
      {
        name: "Philippine Coast Guard District Western Visayas",
        type: "responder",
        category: "Maritime Search & Rescue Unit",
        coordinates: [122.5794, 10.7012],
        address: "Bo. Obrero, Lapuz, Iloilo City",
        phone: "(033) 337-5264"
      },
      {
        name: "Oton MDRRMO Emergency Rescue Unit",
        type: "responder",
        category: "Municipal Disaster Risk Reduction & Rescue",
        coordinates: [122.4768, 10.6953],
        address: "Municipal Hall Compound, Oton, Iloilo",
        phone: "(033) 336-0911"
      },

      // Mental Health Services (healthMentalHealth)
      {
        name: "Western Visayas Medical Center (WVMC) - Acute Psychiatry & Crisis Unit",
        categoryGroup: "healthMentalHealth",
        type: "ambulance",
        category: "Tertiary Psychiatric & Mental Health Crisis Center",
        coordinates: [122.5342, 10.7188],
        address: "Q. Abeto St, Mandurriao, Iloilo City",
        phone: "(033) 321-2841",
        services: "24/7 Acute psychiatric emergency triage, crisis de-escalation, suicide intervention, inpatient psychiatric ward.",
        emergencyAvailable: true
      },
      {
        name: "West Visayas State University Medical Center - Behavioral Medicine & Psychiatry",
        categoryGroup: "healthMentalHealth",
        type: "ambulance",
        category: "University Psychiatric Center & Behavioral Medicine",
        coordinates: [122.5583, 10.7176],
        address: "E. Lopez St, Jaro, Iloilo City",
        phone: "(033) 320-2431",
        services: "Emergency psychiatric evaluations, behavioral crisis stabilization, acute mental healthcare admissions.",
        emergencyAvailable: true
      },
      {
        name: "St. Paul's Hospital Iloilo - Neuro-Psychiatric Emergency Service",
        categoryGroup: "healthMentalHealth",
        type: "ambulance",
        category: "Level 3 Neuro-Psychiatric & Crisis Unit",
        coordinates: [122.5647, 10.6975],
        address: "General Luna St, City Proper, Iloilo City",
        phone: "(033) 337-2741",
        services: "24/7 Acute mental health triage, psychiatric consultations, emergency emotional trauma support.",
        emergencyAvailable: true
      },
      {
        name: "The Medical City Iloilo - Behavioral Health & Crisis Support",
        categoryGroup: "healthMentalHealth",
        type: "ambulance",
        category: "Tertiary Behavioral Health & Crisis Care",
        coordinates: [122.5412, 10.6953],
        address: "Locsin St, Tap-oc, Molo, Iloilo City",
        phone: "(033) 500-1000",
        services: "Psychiatric emergency consultation, crisis intervention, trauma-informed emergency psychiatric liaison.",
        emergencyAvailable: true
      },
      {
        name: "DOH / NCMH Western Visayas Regional Crisis Center",
        categoryGroup: "healthMentalHealth",
        type: "ambulance",
        category: "National & Regional Mental Health Crisis Response",
        coordinates: [122.5350, 10.7190],
        address: "DOH Western Visayas Center for Health Development, Mandurriao, Iloilo City",
        phone: "1553",
        services: "24/7 Toll-free national mental health crisis hotline, psychological first aid, emergency suicide prevention dispatch.",
        emergencyAvailable: true
      },

      // Clinics & Health Centers (healthClinics)
      {
        name: "Mandurriao District Health Center",
        categoryGroup: "healthClinics",
        type: "ambulance",
        category: "Government District Health Center & Urgent Care",
        coordinates: [122.5368, 10.7196],
        address: "Guzman St, Mandurriao, Iloilo City",
        phone: "(033) 321-2777",
        services: "Outpatient medical care, urgent triage, maternal/child health, immunization & emergency first aid.",
        emergencyAvailable: true
      },
      {
        name: "Molo District Health Center",
        categoryGroup: "healthClinics",
        type: "ambulance",
        category: "District Health Center & Primary Clinic",
        coordinates: [122.5458, 10.6977],
        address: "M.H. del Pilar St, Molo, Iloilo City",
        phone: "(033) 337-3011",
        services: "Primary medical emergency triage, wound dressing, community clinic consultations.",
        emergencyAvailable: true
      },
      {
        name: "Jaro District Health Center",
        categoryGroup: "healthClinics",
        type: "ambulance",
        category: "District Health Center & Birthing Clinic",
        coordinates: [122.5620, 10.7280],
        address: "Jaro Plaza, Jaro, Iloilo City",
        phone: "(033) 320-1234",
        services: "24/7 Birthing clinic, emergency outpatient care, acute medical triage.",
        emergencyAvailable: true
      },
      {
        name: "City Proper Health Center",
        categoryGroup: "healthClinics",
        type: "ambulance",
        category: "City Health Office & Urgent Primary Care",
        coordinates: [122.5680, 10.6950],
        address: "Iloilo City Hall Complex, Plaza Libertad, City Proper",
        phone: "(033) 333-1111",
        services: "Emergency primary health services, rabies bite management, diagnostic triage.",
        emergencyAvailable: true
      },

      // Nursing, Care & Rehabilitation (healthCare)
      {
        name: "Iloilo Doctors' Hospital Physical Medicine & Rehabilitation",
        categoryGroup: "healthCare",
        type: "ambulance",
        category: "Hospital Physical Rehabilitation & Care Center",
        coordinates: [122.5489, 10.7001],
        address: "West Timawa, Molo, Iloilo City",
        phone: "(033) 337-7702",
        services: "Acute stroke rehabilitation, orthopedic trauma therapy, inpatient nursing care, hemodialysis unit.",
        emergencyAvailable: true
      },
      {
        name: "WVMC Physical Medicine & Rehabilitation Center",
        categoryGroup: "healthCare",
        type: "ambulance",
        category: "Government Tertiary Rehabilitation Center",
        coordinates: [122.5342, 10.7188],
        address: "Q. Abeto St, Mandurriao, Iloilo City",
        phone: "(033) 321-2841",
        services: "Post-trauma physical therapy, neurological rehabilitation, pediatric rehab, occupational therapy.",
        emergencyAvailable: true
      },
      {
        name: "Medicus Dialysis & Specialty Care Center",
        categoryGroup: "healthCare",
        type: "ambulance",
        category: "Hemodialysis & Nursing Care Specialty Center",
        coordinates: [122.5441, 10.7153],
        address: "Diversion Road, Mandurriao, Iloilo City",
        phone: "(033) 328-7777",
        services: "24/7 Emergency hemodialysis, acute renal care, specialized medical nursing.",
        emergencyAvailable: true
      },
      {
        name: "Philippine Red Cross Regional Blood Center",
        categoryGroup: "healthCare",
        type: "ambulance",
        category: "24/7 Emergency Blood Bank & Transfusion Center",
        coordinates: [122.5641, 10.6989],
        address: "Bonifacio Drive, Iloilo City",
        phone: "(033) 337-5976",
        services: "24/7 Emergency blood supply, platelet concentrates, rapid crossmatching, donor services.",
        emergencyAvailable: true
      },

      // Other Health, Pharmacies & Diagnostic Labs (healthOther)
      {
        name: "WVMC 24/7 Emergency Pharmacy & Laboratory",
        categoryGroup: "healthOther",
        type: "ambulance",
        category: "24-Hour Tertiary Hospital Pharmacy & Diagnostic Lab",
        coordinates: [122.5342, 10.7188],
        address: "Q. Abeto St, Mandurriao, Iloilo City",
        phone: "(033) 321-2841",
        services: "24/7 Critical care medications, antivenom, rabies biologics, STAT laboratory blood panels & CT scan.",
        emergencyAvailable: true
      },
      {
        name: "Mercury Drug 24/7 - Mandurriao Branch",
        categoryGroup: "healthOther",
        type: "ambulance",
        category: "24-Hour Retail Pharmacy & Medical Supplies",
        coordinates: [122.5410, 10.7140],
        address: "R. Mapa St, Mandurriao, Iloilo City",
        phone: "(033) 321-1234",
        services: "24/7 Prescription medications, emergency medical supplies, pediatric and cardiac drugs.",
        emergencyAvailable: true
      },
      {
        name: "Mercury Drug 24/7 - General Luna Branch",
        categoryGroup: "healthOther",
        type: "ambulance",
        category: "24-Hour Central Pharmacy",
        coordinates: [122.5610, 10.6970],
        address: "General Luna St, City Proper, Iloilo City",
        phone: "(033) 337-5678",
        services: "24/7 Emergency medicines, first aid supplies, surgical dressings, oxygen supplies.",
        emergencyAvailable: true
      },
      {
        name: "Medicus Diagnostic Center & Laboratory",
        categoryGroup: "healthOther",
        type: "ambulance",
        category: "Full-Service Diagnostic & Laboratory Center",
        coordinates: [122.5441, 10.7153],
        address: "Diversion Road, Mandurriao, Iloilo City",
        phone: "(033) 328-7777",
        services: "Rapid blood testing, digital X-ray, ultrasound, ECG, pathology testing.",
        emergencyAvailable: true
      }
    ];
    const SERVICE_CATEGORIES_METADATA = [
      {
        id: 'healthMentalHealth',
        name: 'Mental Health Services',
        icon: '🧠',
        crisisLine: '1553',
        description: 'verified 24/7 facilities providing acute psychiatric emergency triage, crisis intervention, and inpatient behavioral healthcare',
        regex: /mental\s*health|psychiatr|psycholog|behavioral\s*health|crisis\s*center|counseling|mental\s*clinic|mental\s*hospital|mental\s*facility|suicide|depression\s*help|emotional\s*crisis/i
      },
      {
        id: 'healthClinics',
        name: 'Clinics & Health Centers',
        icon: '🩺',
        description: 'district health centers, primary outpatient clinics, and urgent care facilities providing immediate medical assistance',
        regex: /clinic|health\s*center|health_centre|urgent\s*care|birthing\s*center|lying\s*in|outpatient\s*clinic/i
      },
      {
        id: 'healthCare',
        name: 'Nursing, Care & Rehabilitation',
        icon: '♿',
        description: 'inpatient rehabilitation medicine, dialysis, specialized nursing, and emergency blood transfusion facilities',
        regex: /rehab|rehabilitation|nursing\s*home|dialysis|blood\s*bank|physical\s*therapy|physiotherapy|hospice|palliative/i
      },
      {
        id: 'healthOther',
        name: 'Pharmacies & Diagnostic Laboratories',
        icon: '💊',
        description: '24/7 hospital pharmacies, full-service diagnostic centers, STAT laboratory panels, and emergency medical dispensaries',
        regex: /pharmacy|drugstore|laboratory|diagnostic|blood\s*test|medical\s*supply|mercury\s*drug|watsons/i
      },
      {
        id: 'healthHospitals',
        name: 'Hospitals & Emergency Trauma Centers',
        icon: '🏥',
        description: 'level 2 and tertiary hospitals with 24/7 emergency rooms, trauma surgeons, and advanced resuscitation bays',
        regex: /hospital|emergency\s*room|\ber\b|trauma\s*center|tertiary\s*hospital/i
      },
      {
        id: 'emergencyPolice',
        name: 'Police Stations & Law Enforcement',
        icon: '🚓',
        description: 'PNP municipal police stations, district precincts, and headquarters ready for emergency patrol dispatch',
        regex: /police|pnp|precinct|patrol|law\s*enforcement/i
      },
      {
        id: 'emergencyFire',
        name: 'Fire Stations & Rescue Engines',
        icon: '🚒',
        description: 'BFP sub-fire stations and volunteer fire brigades equipped with emergency water tankers and ladder engines',
        regex: /fire\s*station|fire\s*department|bfp|fire\s*truck|fire\s*engine|volunteer\s*fire/i
      },
      {
        id: 'emergencyResponders',
        name: 'Search & Rescue / Disaster Responders',
        icon: '🛟',
        description: 'CDRRMO, Philippine Coast Guard, and Red Cross emergency disaster response units',
        regex: /rescue|responder|coast\s*guard|cdrrmo|pdrrmo|disaster\s*response|search\s*and\s*rescue/i
      }
    ];

    function matchServiceCategoryQuery(queryText) {
      if (!queryText) return null;
      const q = String(queryText).trim().toLowerCase();
      // Prioritize mental health first to avoid accidental broad clinic overlap
      if (/mental|psychiatr|psycholog|behavioral|suicide|depression/i.test(q)) {
        return SERVICE_CATEGORIES_METADATA.find(function (c) { return c.id === 'healthMentalHealth'; });
      }
      for (let i = 0; i < SERVICE_CATEGORIES_METADATA.length; i++) {
        const cat = SERVICE_CATEGORIES_METADATA[i];
        if (cat.regex.test(q)) {
          return cat;
        }
      }
      return null;
    }

    function queryNearestFacilitiesByServiceCategory(categoryGroupId, originPoint) {
      if (!originPoint) {
        const userLoc = typeof getDetectedUserLocation === 'function' ? getDetectedUserLocation() : null;
        const originCoords = (userLoc && userLoc.coords) || [122.5368, 10.7196];
        originPoint = L.latLng(originCoords[1], originCoords[0]);
      }

      // Collect all facilities belonging to this categoryGroup
      let candidates = KNOWN_EMERGENCY_FACILITIES.filter(function (f) {
        if (categoryGroupId === 'healthMentalHealth') {
          return f.categoryGroup === 'healthMentalHealth' || (f.category && /mental|psychiat/i.test(f.category));
        }
        if (categoryGroupId === 'healthClinics') {
          return f.categoryGroup === 'healthClinics' || (f.category && /clinic|health center/i.test(f.category));
        }
        if (categoryGroupId === 'healthCare') {
          return f.categoryGroup === 'healthCare' || (f.category && /rehab|dialysis|care|blood bank/i.test(f.category));
        }
        if (categoryGroupId === 'healthOther') {
          return f.categoryGroup === 'healthOther' || (f.category && /pharmacy|lab/i.test(f.category));
        }
        if (categoryGroupId === 'healthHospitals') {
          return f.type === 'ambulance' && (!f.categoryGroup || f.categoryGroup === 'healthHospitals');
        }
        if (categoryGroupId === 'emergencyPolice') {
          return f.type === 'police';
        }
        if (categoryGroupId === 'emergencyFire') {
          return f.type === 'fire';
        }
        if (categoryGroupId === 'emergencyResponders') {
          return f.type === 'responder';
        }
        return false;
      });

      // Calculate distance and driving ETA for each
      const scored = candidates.map(function (fac) {
        const facPoint = L.latLng(fac.coordinates[1], fac.coordinates[0]);
        const distMeters = Math.round(originPoint.distanceTo(facPoint));
        const distKm = (distMeters / 1000).toFixed(1);
        const etaMins = Math.max(1, Math.round((distMeters / 1000) / 30 * 60)); // ~30 km/h city corridor speed
        return {
          facility: fac,
          name: fac.name,
          category: fac.category,
          address: fac.address,
          phone: fac.phone,
          coordinates: fac.coordinates,
          services: fac.services || fac.category,
          distMeters: distMeters,
          distKm: distKm,
          etaMins: etaMins
        };
      });

      // Sort nearest first
      scored.sort(function (a, b) {
        return a.distMeters - b.distMeters;
      });

      return scored;
    }

    const DOCTOR_SPECIALIZATIONS_METADATA = [
      {
        id: 'pedia',
        specialtyName: 'Pediatrics (Pedia / Child Care)',
        doctorTitle: 'Pediatrician / Child Specialist',
        icon: '👶',
        description: '24/7 pediatric emergency rooms, neonatal ICU (NICU), acute childhood illnesses, and pediatric specialists',
        regex: /\b(?:pedia|pediatric\w*|pediatrician|child\s*(?:doctor|specialist|care)|baby\s*doctor|kid\s*doctor|children\s*(?:hospital|clinic)|neonatal|pedia\s*clinic)\b/i
      },
      {
        id: 'cardio',
        specialtyName: 'Cardiology (Cardio / Heart Care)',
        doctorTitle: 'Cardiologist / Heart Specialist',
        icon: '🫀',
        description: 'cardiac catheterization labs (Cath Lab), heart centers, coronary intensive care, and acute chest pain triage',
        regex: /\b(?:cardio|cardiology|cardiologist|heart\s*(?:doctor|specialist|center|station)|cardiac|coronary|chest\s*pain\s*clinic)\b/i
      },
      {
        id: 'ent',
        specialtyName: 'ENT (Ear, Nose & Throat / Otolaryngology)',
        doctorTitle: 'ENT Specialist / Otolaryngologist',
        icon: '👂',
        description: 'ear-nose-throat emergency clinics, foreign body airway extraction, hearing diagnostics, and head & neck surgery',
        regex: /\b(?:ent|otorhinolaryngol\w*|otolaryngol\w*|ear\s*nose\s*throat|ear\s*(?:doctor|specialist)|nose\s*(?:doctor|specialist)|throat\s*(?:doctor|specialist)|audiolog\w*)\b/i
      },
      {
        id: 'obgyn',
        specialtyName: 'OB-GYN (Obstetrics & Gynecology / Maternity)',
        doctorTitle: 'OB-GYN / Maternity Specialist',
        icon: '🤰',
        description: 'emergency obstetric delivery, maternal-fetal medicine, high-risk pregnancy triage, and gynecologic surgery',
        regex: /\b(?:ob[- ]?gyn|obstetric\w*|gynecol\w*|maternity|maternal|pregnancy\s*doctor|birthing|prenatal|women\s*doctor|gynecologist)\b/i
      },
      {
        id: 'ortho',
        specialtyName: 'Orthopedics (Ortho / Bone & Joint)',
        doctorTitle: 'Orthopedic Surgeon / Bone Specialist',
        icon: '🦴',
        description: 'bone fracture trauma centers, joint replacement, emergency casting, spine stabilization, and orthopedic surgery',
        regex: /\b(?:ortho|orthopedic\w*|orthopedist|bone\s*(?:doctor|specialist|clinic)|fracture\s*clinic|joint\s*specialist|spine\s*(?:doctor|specialist)|musculoskeletal)\b/i
      },
      {
        id: 'neuro',
        specialtyName: 'Neurology & Neurosurgery (Brain & Spine)',
        doctorTitle: 'Neurologist / Neurosurgeon',
        icon: '🧠',
        description: 'comprehensive acute stroke centers, neuro-intensive care, intracranial hemorrhage triage, and neurosurgery',
        regex: /\b(?:neuro|neurolog\w*|neurosurgeon|brain\s*(?:doctor|specialist)|stroke\s*center|spine\s*surgeon|neuropathy)\b/i
      },
      {
        id: 'pulmo',
        specialtyName: 'Pulmonology (Pulmo / Lung & Respiratory)',
        doctorTitle: 'Pulmonologist / Lung Specialist',
        icon: '🫁',
        description: 'pulmonary critical care, acute respiratory distress, severe asthma triage, and mechanical ventilation units',
        regex: /\b(?:pulmo|pulmonolog\w*|lung\s*(?:doctor|specialist)|chest\s*(?:doctor|specialist)|respiratory\s*clinic|asthma\s*doctor)\b/i
      },
      {
        id: 'ophthal',
        specialtyName: 'Ophthalmology (Eye & Vision Care)',
        doctorTitle: 'Ophthalmologist / Eye Specialist',
        icon: '👁️',
        description: 'ocular emergency triage, corneal trauma, retinal detachment, and specialized eye surgery clinics',
        regex: /\b(?:ophthal\w*|eye\s*(?:doctor|specialist|clinic|center)|optometr\w*|cornea\s*specialist|retina\s*specialist)\b/i
      },
      {
        id: 'derma',
        specialtyName: 'Dermatology (Derma / Skin Care)',
        doctorTitle: 'Dermatologist / Skin Specialist',
        icon: '🧴',
        description: 'acute dermatology consultation, allergic skin eruptions, severe burns, and dermatologic diagnostics',
        regex: /\b(?:derma|dermatolog\w*|skin\s*(?:doctor|specialist|clinic))\b/i
      },
      {
        id: 'gastro',
        specialtyName: 'Gastroenterology (Gastro / Digestive)',
        doctorTitle: 'Gastroenterologist / GI Specialist',
        icon: '🩺',
        description: 'gastrointestinal endoscopy units, acute GI hemorrhage intervention, liver, and digestive emergency care',
        regex: /\b(?:gastro|gastroenterolog\w*|gi\s*specialist|digestive\s*doctor|stomach\s*doctor|endoscopy)\b/i
      },
      {
        id: 'nephro',
        specialtyName: 'Nephrology (Kidney & Dialysis)',
        doctorTitle: 'Nephrologist / Kidney Specialist',
        icon: '🩸',
        description: '24/7 hemodialysis centers, acute kidney injury resuscitation, and renal specialty inpatient units',
        regex: /\b(?:nephro|nephrolog\w*|kidney\s*(?:doctor|specialist)|renal\s*clinic|hemodialysis\s*center)\b/i
      },
      {
        id: 'surgery',
        specialtyName: 'General & Trauma Surgery',
        doctorTitle: 'Trauma Surgeon / General Surgeon',
        icon: '⚕️',
        description: '24/7 emergency operating theaters, acute surgical trauma resuscitation, and acute abdomen intervention',
        regex: /\b(?:surgeon|surgery|trauma\s*surgeon|general\s*surgeon|surgical\s*clinic|operating\s*room)\b/i
      }
    ];

    function matchDoctorSpecializationQuery(queryText) {
      if (!queryText) return null;
      const q = String(queryText).trim().toLowerCase();
      for (let i = 0; i < DOCTOR_SPECIALIZATIONS_METADATA.length; i++) {
        const spec = DOCTOR_SPECIALIZATIONS_METADATA[i];
        if (spec.regex.test(q)) {
          return spec;
        }
      }
      return null;
    }

    function queryNearestFacilitiesByDoctorSpecialization(specialtyId, originPoint) {
      if (!originPoint) {
        const userLoc = typeof getDetectedUserLocation === 'function' ? getDetectedUserLocation() : null;
        const originCoords = (userLoc && userLoc.coords) || [122.5368, 10.7196];
        originPoint = L.latLng(originCoords[1], originCoords[0]);
      }

      // Filter facilities that provide this doctor specialization
      const candidates = KNOWN_EMERGENCY_FACILITIES.filter(function (fac) {
        if (!fac.specializations || !Array.isArray(fac.specializations)) return false;
        return fac.specializations.includes(specialtyId);
      });

      // Calculate distance and driving ETA for each
      const scored = candidates.map(function (fac) {
        const facPoint = L.latLng(fac.coordinates[1], fac.coordinates[0]);
        const distMeters = Math.round(originPoint.distanceTo(facPoint));
        const distKm = (distMeters / 1000).toFixed(1);
        const etaMins = Math.max(1, Math.round((distMeters / 1000) / 30 * 60)); // ~30 km/h city corridor speed
        const deptNote = (fac.specialtyNotes && fac.specialtyNotes[specialtyId]) || fac.services || fac.category;
        return {
          facility: fac,
          name: fac.name,
          category: fac.category,
          address: fac.address,
          phone: fac.phone,
          coordinates: fac.coordinates,
          departmentService: deptNote,
          distMeters: distMeters,
          distKm: distKm,
          etaMins: etaMins
        };
      });

      // Sort nearest first
      scored.sort(function (a, b) {
        return a.distMeters - b.distMeters;
      });

      return scored;
    }

    function findFastestSpecializationService(specialtyId) {
      const spec = typeof matchDoctorSpecializationQuery === 'function' ? DOCTOR_SPECIALIZATIONS_METADATA.find(function (s) { return s.id === specialtyId; }) : null;
      const specLabel = spec ? spec.specialtyName : 'Doctor Specialty';
      const userLoc = typeof getDetectedUserLocation === 'function' ? getDetectedUserLocation() : null;
      const originCoords = (userLoc && userLoc.coords) || (userLocationMarker && [userLocationMarker.getLatLng().lng, userLocationMarker.getLatLng().lat]) || routeOrigin || initialCenter || [122.5368, 10.7196];
      const originPoint = L.latLng(originCoords[1], originCoords[0]);
      routeOrigin = originCoords;
      emergencySearchType = 'ambulance';
      isAssistanceSearch = true;

      const sorted = queryNearestFacilitiesByDoctorSpecialization(specialtyId, originPoint);
      if (!sorted || sorted.length === 0) return;

      if (emergencyAssistance) {
        emergencyAssistance.hidden = true;
        document.body.classList.remove('emergency-panel-open');
      }
      if (emergencyOpenButton) {
        emergencyOpenButton.setAttribute('aria-expanded', 'false');
      }
      expandSidebar();
      syncEmergencyOpenButtonVisibility();

      const mappedCandidates = sorted.map(function (s) {
        return {
          name: s.name,
          category: s.departmentService || (spec ? spec.doctorTitle : 'Specialist Department'),
          coordinates: s.coordinates,
          distanceMeters: s.distMeters,
          phone: s.phone || '',
          address: s.address || '',
          type: 'ambulance',
          selectService: function () {
            selectedServiceCoordinates = s.coordinates;
            if (window.innerWidth > 640) {
              expandSidebar();
            }
            destinationInput.value = s.name;
            showServiceDetails(
              s.name,
              s.category,
              [
                ['Address', s.address],
                ['Phone', s.phone, 'phone'],
                ['Specialization', s.departmentService || (spec ? spec.doctorTitle : 'Specialist Care')]
              ],
              '#d93025',
              '',
              {
                callNumber: s.phone,
                messageNumber: s.phone,
                type: 'ambulance',
                onNeedAssistance: function () {
                  openAssistanceChat({
                    name: s.name,
                    category: s.category,
                    phone: s.phone,
                    coordinates: s.coordinates,
                    type: 'ambulance'
                  });
                }
              }
            );
            searchDestination(s.name, s.coordinates, { emergencyType: 'ambulance', facility: s.facility });
          }
        };
      });

      const sidebarContainer = document.getElementById('emergency-results-list');
      if (sidebarContainer) {
        sidebarContainer.hidden = false;
      }

      renderEmergencyFacilitiesList(mappedCandidates.slice(0, 8), 'ambulance', specLabel);

      const nearest = mappedCandidates[0];
      const distKm = (nearest.distanceMeters / 1000).toFixed(1);
      const estMins = Math.max(1, Math.round(nearest.distanceMeters / 500));
      nearest.selectService();

      showEmergencyRouteConfirmationBar({
        name: nearest.name,
        category: nearest.category,
        distKm: distKm,
        durationMins: estMins,
        coordinates: nearest.coordinates,
        phone: nearest.phone,
        type: 'ambulance'
      }, false);

      setStatus('🧭 Route Preview: Viewing route to nearest ' + specLabel + ': ' + nearest.name + ' (~' + estMins + ' min).');
    }

    function findFastestCategoryService(categoryId) {
      const cat = typeof matchServiceCategoryQuery === 'function' ? SERVICE_CATEGORIES_METADATA.find(function (c) { return c.id === categoryId; }) : null;
      const catLabel = cat ? cat.name : 'Specialized Care';
      const userLoc = typeof getDetectedUserLocation === 'function' ? getDetectedUserLocation() : null;
      const originCoords = (userLoc && userLoc.coords) || (userLocationMarker && [userLocationMarker.getLatLng().lng, userLocationMarker.getLatLng().lat]) || routeOrigin || initialCenter || [122.5368, 10.7196];
      const originPoint = L.latLng(originCoords[1], originCoords[0]);
      routeOrigin = originCoords;
      emergencySearchType = 'ambulance';
      isAssistanceSearch = true;

      const sorted = queryNearestFacilitiesByServiceCategory(categoryId, originPoint);
      if (!sorted || sorted.length === 0) return;

      if (emergencyAssistance) {
        emergencyAssistance.hidden = true;
        document.body.classList.remove('emergency-panel-open');
      }
      if (emergencyOpenButton) {
        emergencyOpenButton.setAttribute('aria-expanded', 'false');
      }
      expandSidebar();
      syncEmergencyOpenButtonVisibility();

      const mappedCandidates = sorted.map(function (s) {
        return {
          name: s.name,
          category: s.services || s.category,
          coordinates: s.coordinates,
          distanceMeters: s.distMeters,
          phone: s.phone || '',
          address: s.address || '',
          type: 'ambulance',
          selectService: function () {
            selectedServiceCoordinates = s.coordinates;
            if (window.innerWidth > 640) {
              expandSidebar();
            }
            destinationInput.value = s.name;
            showServiceDetails(
              s.name,
              s.category,
              [
                ['Address', s.address],
                ['Phone', s.phone, 'phone'],
                ['Emergency Service', s.services || s.category]
              ],
              '#d93025',
              '',
              {
                callNumber: s.phone,
                messageNumber: s.phone,
                type: 'ambulance',
                onNeedAssistance: function () {
                  openAssistanceChat({
                    name: s.name,
                    category: s.category,
                    phone: s.phone,
                    coordinates: s.coordinates,
                    type: 'ambulance'
                  });
                }
              }
            );
            searchDestination(s.name, s.coordinates, { emergencyType: 'ambulance', facility: s.facility });
          }
        };
      });

      const sidebarContainer = document.getElementById('emergency-results-list');
      if (sidebarContainer) {
        sidebarContainer.hidden = false;
      }

      renderEmergencyFacilitiesList(mappedCandidates.slice(0, 8), 'ambulance', catLabel);

      const nearest = mappedCandidates[0];
      const distKm = (nearest.distanceMeters / 1000).toFixed(1);
      const estMins = Math.max(1, Math.round(nearest.distanceMeters / 500));
      nearest.selectService();

      showEmergencyRouteConfirmationBar({
        name: nearest.name,
        category: nearest.category,
        distKm: distKm,
        durationMins: estMins,
        coordinates: nearest.coordinates,
        phone: nearest.phone,
        type: 'ambulance'
      }, false);

      setStatus('🧭 Route Preview: Viewing route to nearest ' + catLabel + ': ' + nearest.name + ' (~' + estMins + ' min).');
    }

    const baseLayers = {
      'Satellite': satelliteLayer,
      'Terrain': terrainLayer,
      'Topographic': topographicLayer,
      'Shaded Relief': reliefLayer
    };
    const baseLayerRadios = {};
    let activeBaseLayerName = 'Satellite';
    function setBaseLayer(name) {
      Object.keys(baseLayers).forEach(function (layerName) {
        map.removeLayer(baseLayers[layerName]);
      });

      map.addLayer(baseLayers[name]);
      activeBaseLayerName = name;
      Object.keys(baseLayerRadios).forEach(function (layerName) {
        baseLayerRadios[layerName].checked = layerName === name;
      });
    }
    let trafficLayer = null;
    if (esriTrafficApiKey) {
      trafficLayer = L.tileLayer(
        'https://traffic.arcgis.com/arcgis/rest/services/World/Traffic/MapServer/tile/{z}/{y}/{x}?token=' +
        encodeURIComponent(esriTrafficApiKey),
        {
          maxNativeZoom: 18,
          maxZoom: 22,
          attribution: 'Traffic data &copy; Esri'
        }
      );
    }
    const liveEventsLayerGroup = L.layerGroup().addTo(map);

    function haversineMeters(lat1, lon1, lat2, lon2) {
      const R = 6371000.0;
      const dLat = (lat2 - lat1) * Math.PI / 180.0;
      const dLon = (lon2 - lon1) * Math.PI / 180.0;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180.0) * Math.cos(lat2 * Math.PI / 180.0) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    const liveIncidents = [
      {
        id: 'inc-flood-1',
        name: 'Flash Flood Hazard',
        type: 'flood',
        icon: '🌊',
        color: '#d93025',
        lat: 10.7080,
        lng: 122.5620,
        radius: 200,
        penaltySeconds: 600,
        impassable: false
      },
      {
        id: 'inc-closure-1',
        name: 'Festival / Street Marathon Closure',
        type: 'closure',
        icon: '⛔',
        color: '#b3261e',
        lat: 10.7010,
        lng: 122.5550,
        radius: 240,
        penaltySeconds: Infinity,
        impassable: true
      },
      {
        id: 'inc-work-1',
        name: 'Roadwork & Pipe Repair',
        type: 'construction',
        icon: '🚧',
        color: '#e37400',
        lat: 10.6965,
        lng: 122.5480,
        radius: 170,
        penaltySeconds: 360,
        impassable: false
      }
    ];

    const trafficCongestedRoads = {
      'General Luna Street': 3.2,
      'Benigno Aquino Avenue': 2.5,
      'Iznart Street': 2.8,
      'Jalandoni Street': 2.1,
      'Infante Avenue': 2.2,
      'Ledesma Street': 2.4
    };

    function renderIncidentMarkers() {
      liveEventsLayerGroup.clearLayers();
      liveIncidents.forEach(function (incident) {
        const circle = L.circle([incident.lat, incident.lng], {
          radius: incident.radius,
          color: incident.color,
          fillColor: incident.color,
          fillOpacity: 0.22,
          weight: 2,
          dashArray: incident.impassable ? '6, 6' : '3, 4'
        }).addTo(liveEventsLayerGroup);

        const iconHtml = document.createElement('div');
        iconHtml.className = 'incident-marker-icon';
        iconHtml.style.backgroundColor = incident.color;
        iconHtml.textContent = incident.icon;

        const icon = L.divIcon({
          className: 'incident-div-icon',
          html: iconHtml,
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        });

        const marker = L.marker([incident.lat, incident.lng], {
          icon: icon,
          title: incident.name
        }).addTo(liveEventsLayerGroup);

        const popup = document.createElement('div');
        popup.className = 'incident-popup';
        const h4 = document.createElement('h4');
        h4.textContent = incident.icon + ' ' + incident.name;
        popup.appendChild(h4);

        const p = document.createElement('p');
        p.textContent = (incident.impassable ? 'Road blocked (impassable). Routes must detour.' : 'Active hazard: +' + Math.round(incident.penaltySeconds / 60) + ' min estimated delay.') + ' Radius: ' + incident.radius + 'm.';
        popup.appendChild(p);

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'remove-incident-btn';
        removeBtn.textContent = 'Remove event';
        removeBtn.addEventListener('click', function () {
          const idx = liveIncidents.findIndex(function (i) { return i.id === incident.id; });
          if (idx !== -1) {
            liveIncidents.splice(idx, 1);
            renderIncidentMarkers();
            if (destinationInput && destinationInput.value.trim()) {
              searchDestination(destinationInput.value.trim());
            }
          }
        });
        popup.appendChild(removeBtn);

        marker.bindPopup(popup);
        circle.bindPopup(popup);
      });
    }
    renderIncidentMarkers();
    const serviceCategorySections = [
      {
        label: 'Health services',
        groups: [
          'healthHospitals', 'healthClinics', 'healthCare', 'healthMentalHealth',
          'healthOther'
        ]
      },
      {
        label: 'Emergency response facilities',
        groups: [
          'emergencyAmbulance', 'emergencyResponders', 'emergencyPolice',
          'emergencyFire'
        ]
      }
    ];
    const serviceCategoryCheckboxes = {};
    const accountControl = L.control({ position: 'topright' });
    accountControl.onAdd = function () {
      const container = L.DomUtil.create('div', 'account-control leaflet-control');
      accountControl._container = container;
      if (window.innerWidth > 640) {
        const ap = document.getElementById('account-panel');
        if (ap) container.appendChild(ap);
      }
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);
      return container;
    };
    accountControl.addTo(map);

    function syncAccountButtonPlacement() {
      const accountPanel = document.getElementById('account-panel');
      const destinationRow = document.querySelector('.search-row.destination-row');
      const desktopContainer = accountControl && accountControl._container;
      if (!accountPanel) return;

      if (window.innerWidth <= 640) {
        if (destinationRow && !destinationRow.contains(accountPanel)) {
          destinationRow.appendChild(accountPanel);
        }
      } else {
        if (desktopContainer && !desktopContainer.contains(accountPanel)) {
          desktopContainer.appendChild(accountPanel);
        }
      }
    }

    syncAccountButtonPlacement();
    window.addEventListener('resize', syncAccountButtonPlacement);
    window.addEventListener('resize', syncEmergencyOpenButtonVisibility);
    window.addEventListener('resize', function () {
      if (typeof map !== 'undefined' && map && typeof map.invalidateSize === 'function') {
        map.invalidateSize();
      }
    });

    const categoryControl = L.control({ position: 'bottomleft' });
    categoryControl.onAdd = function () {
      const container = L.DomUtil.create('div', 'map-categories-control leaflet-control');
      const toolbar = L.DomUtil.create('div', 'map-categories-toolbar', container);
      const toggle = L.DomUtil.create('button', 'map-tool-button map-categories-toggle', toolbar);
      toggle.type = 'button';
      toggle.title = 'Layers';
      toggle.setAttribute('aria-label', 'Layers');
      toggle.setAttribute('aria-expanded', 'false');
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('aria-hidden', 'true');
      icon.setAttribute('viewBox', '0 0 24 24');
      [
        'M3 8l9-5 9 5-9 5z',
        'm3 12 9 5 9-5',
        'm3 16 9 5 9-5'
      ].forEach(function (pathData) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathData);
        icon.appendChild(path);
      });
      toggle.appendChild(icon);
      toolbar.appendChild(document.getElementById('history-panel'));
      const panel = L.DomUtil.create('div', 'map-categories-panel', container);
      panel.hidden = true;

      const addSection = function (title) {
        const section = L.DomUtil.create('div', 'map-control-section', panel);
        const heading = L.DomUtil.create('h3', 'map-control-heading', section);
        heading.textContent = title;
        return section;
      };
      const addCheckbox = function (parent, labelText, layer) {
        const row = L.DomUtil.create('label', 'map-control-row', parent);
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = Boolean(layer && map.hasLayer(layer));
        const text = document.createElement('span');
        text.textContent = labelText;
        row.append(checkbox, text);
        checkbox.addEventListener('change', function () {
          if (!layer) return;
          if (checkbox.checked) map.addLayer(layer);
          else map.removeLayer(layer);
          recordActivity('overlay', { label: labelText, enabled: checkbox.checked });
        });
        return checkbox;
      };

      const baseSection = addSection('Map Style');
      Object.keys(baseLayers).forEach(function (label, index) {
        const row = L.DomUtil.create('label', 'map-control-row', baseSection);
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'map-base-layer';
        radio.checked = activeBaseLayerName === label;
        baseLayerRadios[label] = radio;
        const text = document.createElement('span');
        text.textContent = label;
        row.append(radio, text);
        radio.addEventListener('change', function () {
          if (!radio.checked) return;
          setBaseLayer(label);
          recordActivity('map_style', {
            style: label,
            theme: document.documentElement.dataset.theme
          });
        });
      });

      const themeSection = addSection('Theme');
      const themeRow = L.DomUtil.create('div', 'map-control-row theme-control', themeSection);
      const themeSelect = document.createElement('select');
      themeSelect.id = 'theme-select';
      themeSelect.setAttribute('aria-label', 'Theme');
      [
        ['system', 'Device'],
        ['light', 'Light'],
        ['dark', 'Dark']
      ].forEach(function (option) {
        const themeOption = document.createElement('option');
        themeOption.value = option[0];
        themeOption.textContent = option[1];
        themeSelect.appendChild(themeOption);
      });
      themeRow.appendChild(themeSelect);

      const overlaysSection = addSection('Overlays');
      addCheckbox(overlaysSection, 'Place labels', placeLabelsLayer);
      if (trafficLayer) addCheckbox(overlaysSection, 'Live traffic', trafficLayer);
      addCheckbox(overlaysSection, 'Live events & hazards', liveEventsLayerGroup);

      const categoriesSection = addSection('Service categories');
      serviceCategorySections.forEach(function (category) {
        const categoryMain = L.DomUtil.create('div', 'map-category-main', categoriesSection);
        const childPanel = L.DomUtil.create('div', 'map-category-children', categoriesSection);
        childPanel.hidden = true;
        const childCheckboxes = category.groups.map(function (groupName) {
          return {
            checkbox: addCheckbox(childPanel, serviceCategoryLabels[groupName], serviceGroups[groupName]),
            layer: serviceGroups[groupName]
          };
        });
        category.groups.forEach(function (groupName, index) {
          serviceCategoryCheckboxes[groupName] = childCheckboxes[index].checkbox;
        });
        const parentCheckbox = addCheckbox(
          categoryMain,
          category.label,
          null
        );
        const expandButton = L.DomUtil.create('button', 'map-category-expand', categoryMain);
        expandButton.type = 'button';
        expandButton.textContent = '▸';
        expandButton.setAttribute('aria-label', 'Show ' + category.label + ' subcategories');
        expandButton.setAttribute('aria-expanded', 'false');
        expandButton.addEventListener('click', function () {
          childPanel.hidden = !childPanel.hidden;
          expandButton.setAttribute('aria-expanded', String(!childPanel.hidden));
          expandButton.textContent = childPanel.hidden ? '▸' : '▾';
        });
        const updateParentCheckbox = function () {
          const enabledCount = childCheckboxes.filter(function (child) {
            return child.checkbox.checked;
          }).length;
          parentCheckbox.checked = enabledCount === childCheckboxes.length;
          parentCheckbox.indeterminate = enabledCount > 0 && enabledCount < childCheckboxes.length;
        };
        childCheckboxes.forEach(function (child) {
          child.checkbox.addEventListener('change', updateParentCheckbox);
        });
        parentCheckbox.addEventListener('change', function () {
          childCheckboxes.forEach(function (child) {
            child.checkbox.checked = parentCheckbox.checked;
            if (parentCheckbox.checked) map.addLayer(child.layer);
            else map.removeLayer(child.layer);
          });
          parentCheckbox.indeterminate = false;
          recordActivity('overlay', {
            label: category.label,
            enabled: parentCheckbox.checked
          });
        });
        updateParentCheckbox();
      });
      toggle.addEventListener('click', function () {
        panel.hidden = !panel.hidden;
        toggle.setAttribute('aria-expanded', String(!panel.hidden));
        if (!panel.hidden) {
          document.getElementById('history-content').hidden = true;
          document.getElementById('history-toggle').setAttribute('aria-expanded', 'false');
        }
      });
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);
      return container;
    };
    categoryControl.addTo(map);
    initializeThemeSelector();
    map.attributionControl.addAttribution(
      'Service data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
    );
    map.attributionControl.addAttribution(
      'POI search &copy; <a href="https://photon.komoot.io/">Photon</a>'
    );
    map.attributionControl.setPrefix(false);

    const form = document.getElementById('search-form');
    const sourceInput = document.getElementById('source-input');
    const destinationInput = document.getElementById('destination');
    const useMyLocationBtn = document.getElementById('use-my-location');
    const swapLocationsBtn = document.getElementById('swap-locations-button');
    const incidentBanner = document.getElementById('incident-banner');
    const incidentBannerCancel = document.getElementById('incident-banner-cancel');
    let isAddingIncident = false;
    let userDeviceCoords = null;
    let originMarker = null;

    function toggleAddIncidentMode(forceState) {
      isAddingIncident = typeof forceState === 'boolean' ? forceState : !isAddingIncident;
      document.querySelectorAll('.factor-action-btn').forEach(function (btn) {
        btn.classList.toggle('active', isAddingIncident);
      });
      if (incidentBanner) incidentBanner.hidden = !isAddingIncident;
      map.getContainer().style.cursor = isAddingIncident ? 'crosshair' : '';
      if (isAddingIncident) {
        expandSidebar();
        setStatus('Click anywhere on the map to place a live event or hazard zone.');
      } else if (status.textContent.indexOf('Click anywhere') !== -1) {
        setStatus('');
      }
    }

    if (incidentBannerCancel) {
      incidentBannerCancel.addEventListener('click', function () {
        toggleAddIncidentMode(false);
      });
    }

    if (useMyLocationBtn) {
      useMyLocationBtn.addEventListener('click', function () {
        if (typeof requestDeviceLocation === 'function') {
          requestDeviceLocation({ setView: true, userInitiated: true, autoSearch: true });
        } else if (userDeviceCoords) {
          sourceInput.value = 'My device location';
          routeOrigin = userDeviceCoords;
          if (!userManualZoomActive) {
            map.setView([userDeviceCoords[1], userDeviceCoords[0]], 15);
          } else {
            map.panTo([userDeviceCoords[1], userDeviceCoords[0]]);
          }
          if (destinationInput.value.trim()) {
            searchDestination(destinationInput.value.trim());
          }
        }
      });
    }

    if (swapLocationsBtn) {
      swapLocationsBtn.addEventListener('click', function () {
        const temp = sourceInput.value;
        sourceInput.value = destinationInput.value;
        destinationInput.value = temp;
        if (destinationInput.value.trim()) {
          searchDestination(destinationInput.value.trim());
        }
      });
    }

    const status = document.getElementById('status');
    const locationStatus = document.getElementById('location-status');
    const searchPanel = document.querySelector('.search-panel');
    const emergencyOpenButton = document.getElementById('emergency-open');
    const emergencyAssistance = document.getElementById('emergency-assistance');
    const serviceDetails = document.getElementById('service-details');
    const routesElement = document.getElementById('routes');
    const searchButton = document.getElementById('search-button');
    const routeAlgorithmInput = document.getElementById('route-algorithm');
    const accountStatus = document.getElementById('account-status');
    const historyStatus = document.getElementById('history-status');
    const accountToggle = document.getElementById('account-toggle');
    const accountContent = document.getElementById('account-content');
    const accountLoggedOut = document.getElementById('account-logged-out');
    const accountOpenForm = document.getElementById('account-open-form');
    const accountForm = document.getElementById('account-form');
    const signupNameRow = document.getElementById('signup-name-row');
    const signupNameInput = document.getElementById('signup-name');
    const accountEmailInput = document.getElementById('account-email');
    const accountPasswordInput = document.getElementById('account-password');
    const accountSubmit = document.getElementById('account-submit');
    const accountModeButton = document.getElementById('account-mode');
    const accountLoggedIn = document.getElementById('account-logged-in');
    const accountIdentity = document.getElementById('account-identity');
    const profileNameInput = document.getElementById('profile-name');
    const activityHistory = document.getElementById('activity-history');
    const clearHistoryButton = document.getElementById('clear-history');
    const historyToggle = document.getElementById('history-toggle');
    const historyContent = document.getElementById('history-content');
    const historyLoggedOut = document.getElementById('history-logged-out');
    const historyLoggedIn = document.getElementById('history-logged-in');

    // Auth Modal DOM references
    const authModalOverlay = document.getElementById('auth-modal-overlay');
    const authModal = document.getElementById('auth-modal');
    const authModalClose = document.getElementById('auth-modal-close');
    const authModalTitle = document.getElementById('auth-modal-title');
    const authModalSubtitle = document.getElementById('auth-modal-subtitle');
    const authTablist = document.getElementById('auth-tablist');
    const authTabSignin = document.getElementById('auth-tab-signin');
    const authTabSignup = document.getElementById('auth-tab-signup');
    const authModalStatus = document.getElementById('auth-modal-status');
    const authStatusIcon = document.getElementById('auth-status-icon');
    const authStatusText = document.getElementById('auth-status-text');
    const authModalForm = document.getElementById('auth-modal-form');
    const authFieldNameGroup = document.getElementById('auth-field-name-group');
    const authInputName = document.getElementById('auth-input-name');
    const authFieldEmailGroup = document.getElementById('auth-field-email-group');
    const authInputEmail = document.getElementById('auth-input-email');
    const authFieldPasswordGroup = document.getElementById('auth-field-password-group');
    const authInputPassword = document.getElementById('auth-input-password');
    const authFieldConfirmPasswordGroup = document.getElementById('auth-field-confirm-password-group');
    const authInputConfirmPassword = document.getElementById('auth-input-confirm-password');
    const authTogglePassword = document.getElementById('auth-toggle-password');
    const authPasswordHint = document.getElementById('auth-password-hint');
    const authForgotPasswordLink = document.getElementById('auth-forgot-password-link');
    const authFormOptions = document.getElementById('auth-form-options');
    const authRememberMe = document.getElementById('auth-remember-me');
    const authModalSubmit = document.getElementById('auth-modal-submit');
    const authBtnSpinner = document.getElementById('auth-btn-spinner');
    const authBtnText = document.getElementById('auth-btn-text');
    const authBtnIcon = document.getElementById('auth-btn-icon');
    const authFooterToggle = document.getElementById('auth-footer-toggle');
    const authFooterQuestion = document.getElementById('auth-footer-question');
    const authSwitchModeBtn = document.getElementById('auth-switch-mode-btn');
    const authFooterResetBack = document.getElementById('auth-footer-reset-back');
    const authBackToSigninBtn = document.getElementById('auth-back-to-signin-btn');
    const authOfflineBadge = document.getElementById('auth-offline-badge');
    const accountOpenSignin = document.getElementById('account-open-signin');
    const accountOpenSignup = document.getElementById('account-open-signup');
    const historyOpenSignin = document.getElementById('history-open-signin');
    const accountViewHistoryBtn = document.getElementById('account-view-history-btn');
    const accountSwitchBtn = document.getElementById('account-switch-btn');
    const authSigninRoleGroup = document.getElementById('auth-signin-role-group');
    const authPortalMap = document.getElementById('auth-portal-map');
    const authPortalResponder = document.getElementById('auth-portal-responder');
    const authFieldRoleGroup = document.getElementById('auth-field-role-group');
    const authRoleCardPersonal = document.getElementById('auth-role-card-personal');
    const authRoleCardResponder = document.getElementById('auth-role-card-responder');
    const authRolePersonal = document.getElementById('auth-role-personal');
    const authRoleResponder = document.getElementById('auth-role-responder');
    const accountRoleBadge = document.getElementById('account-role-badge');
    const accountGoResponder = document.getElementById('account-go-responder');
    const profileRoleSelect = document.getElementById('profile-role-select');
    const lazyScriptPromises = Object.create(null);
    function loadScriptOnce(key, src, isReady) {
      if (isReady()) return Promise.resolve();
      if (!lazyScriptPromises[key]) {
        lazyScriptPromises[key] = new Promise(function (resolve, reject) {
          const script = document.createElement('script');
          script.src = src;
          script.async = true;
          script.onload = resolve;
          script.onerror = function () { reject(new Error('Could not load ' + key + '.')); };
          document.head.appendChild(script);
        });
      }
      return lazyScriptPromises[key];
    }
    let selectedPortalMode = 'personal';
    let selectedSignupRole = 'personal';
    let currentAuthMode = 'signin';

    let supabaseClient = null;
    let currentUser = null;
    let isSignUpMode = false;
    let ownEmergencyAlertChannel = null;
    const OFFLINE_CACHE_PREFIX = 'osm-map-offline-v1:';

    function readOfflineCache(key, fallback) {
      try {
        const value = window.localStorage.getItem(OFFLINE_CACHE_PREFIX + key);
        return value === null ? fallback : JSON.parse(value);
      } catch (error) {
        return fallback;
      }
    }

    function writeOfflineCache(key, value) {
      try {
        window.localStorage.setItem(OFFLINE_CACHE_PREFIX + key, JSON.stringify(value));
      } catch (error) {
        console.warn('Could not save offline map data:', error);
      }
    }
    accountToggle.addEventListener('click', function () {
      const willOpen = accountContent.hidden;
      accountContent.hidden = !willOpen;
      accountToggle.setAttribute('aria-expanded', String(willOpen));
      if (willOpen) initializeAccount();
    });
    historyToggle.addEventListener('click', function () {
      const willOpen = historyContent.hidden;
      historyContent.hidden = !willOpen;
      historyToggle.setAttribute('aria-expanded', String(willOpen));
      if (willOpen) initializeAccount();
      if (willOpen) {
        const layersPanel = document.querySelector('.map-categories-panel');
        const layersToggle = document.querySelector('.map-categories-toggle');
        if (layersPanel) layersPanel.hidden = true;
        if (layersToggle) layersToggle.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('click', function (event) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const el = target instanceof Element ? target : target.parentElement;

      // Close auth modal when clicking directly on overlay backdrop
      if (authModalOverlay && !authModalOverlay.hidden && target === authModalOverlay) {
        closeAuthModal();
        return;
      }

      // Detect if click is on an interactive element or content
      const isInteractive = Boolean(el && el.closest(
        'input, textarea, select, label, button, a, [role="button"], ' +
        '.service-pin, .service-badge, .service-name, .leaflet-marker-icon, .leaflet-popup, ' +
        '.emergency-facility-card, .route-card, .chatbox-input-form, .chat-msg, .chat-chip, .chat-action-btn, ' +
        '#account-panel, #history-panel, .map-categories-panel, .map-categories-toggle, .leaflet-control, ' +
        '#assistance-chatbox, #auth-modal-overlay, .auth-modal'
      ));

      // Check if click was inside any UI panel or modal
      const isInsidePanels = Boolean(el && el.closest(
        '#map-search-controls, #emergency-assistance, #assistance-chatbox, ' +
        '#account-panel, #history-panel, .map-categories-control, .leaflet-control, #auth-modal-overlay, .auth-modal'
      ));

      // Collapse panels when clicking at any area that has no buttons or interactive controls
      if (!isInteractive) {
        collapseSidebar();
      } else if (!isInsidePanels) {
        if (!emergencyAssistance.hidden && !emergencyAssistance.contains(target) && !emergencyOpenButton.contains(target)) {
          collapseSidebar();
        }
      }

      const accountPanel = document.getElementById('account-panel');
      const historyPanel = document.getElementById('history-panel');
      const layersControl = document.querySelector('.map-categories-control');
      const layersPanel = layersControl && layersControl.querySelector('.map-categories-panel');
      const layersToggle = layersControl && layersControl.querySelector('.map-categories-toggle');
      if (accountPanel && !accountPanel.contains(target)) {
        accountContent.hidden = true;
        accountToggle.setAttribute('aria-expanded', 'false');
      }
      if (historyPanel && !historyPanel.contains(target)) {
        historyContent.hidden = true;
        historyToggle.setAttribute('aria-expanded', 'false');
      }
      const clickedLayers = (layersPanel && layersPanel.contains(target)) ||
        (layersToggle && layersToggle.contains(target));
      if (layersControl && !clickedLayers) {
        if (layersPanel) layersPanel.hidden = true;
        if (layersToggle) layersToggle.setAttribute('aria-expanded', 'false');
      }
    }, true);
    const routeLayers = L.featureGroup().addTo(map);
    const serviceMarkerGroups = Object.keys(serviceGroups).map(function (groupName) {
      return serviceGroups[groupName];
    });
    let routeOrigin = initialCenter;
    let userLocationMarker = null;

    let userManualZoomActive = false;
    map.on('zoomstart', function (event) {
      if (event.originalEvent) {
        userManualZoomActive = true;
      }
    });

    function collapseEmergencyServicePanel() {
      if (emergencyAssistance) {
        emergencyAssistance.hidden = true;
      }
      document.body.classList.remove('emergency-panel-open');
      if (window.innerWidth <= 640) {
        const mapSearchControls = document.getElementById('map-search-controls');
        if (mapSearchControls) {
          mapSearchControls.classList.remove('sidebar-expanded');
        }
        document.body.classList.remove('sidebar-expanded');
        isSidebarExpanded = false;
        const serviceDetails = document.getElementById('service-details');
        if (serviceDetails && currentEmergencyTarget) {
          serviceDetails.hidden = true;
        }
      }
      syncEmergencyOpenButtonVisibility();
      if (typeof map !== 'undefined' && map) {
        setTimeout(function () {
          map.invalidateSize();
          if (typeof routeLayers !== 'undefined' && routeLayers.getBounds && routeLayers.getBounds().isValid()) {
            fitMapBoundsSafely(routeLayers.getBounds(), true);
          }
        }, 80);
      }
    }

    function fitMapBoundsSafely(bounds, force) {
      if (!bounds || !bounds.isValid()) return;
      if (userManualZoomActive && !force) {
        return;
      }
      const isMobile = window.innerWidth <= 640;
      const size = map.getSize();

      if (isMobile) {
        const confirmBar = document.getElementById('route-emergency-confirm-bar');
        const hasConfirmBar = confirmBar && !confirmBar.hidden;
        const padBottom = hasConfirmBar ? Math.min(240, Math.max(140, Math.floor(size.y * 0.32))) : 50;
        const padTop = Math.min(90, Math.max(35, Math.floor(size.y * 0.12)));
        try {
          map.fitBounds(bounds, {
            paddingTopLeft: [20, padTop],
            paddingBottomRight: [20, padBottom],
            maxZoom: 16
          });
        } catch (e) {
          map.fitBounds(bounds, { padding: [25, 25], maxZoom: 16 });
        }
      } else {
        const padLeft = Math.min(380, Math.max(30, Math.floor(size.x * 0.35)));
        const padTop = Math.min(80, Math.max(30, Math.floor(size.y * 0.15)));
        try {
          map.fitBounds(bounds, {
            paddingTopLeft: [padLeft, padTop],
            paddingBottomRight: [30, 30]
          });
        } catch (e) {
          map.fitBounds(bounds, { padding: [20, 20] });
        }
      }
    }

    function renderUserLocationMarker(latlng, accuracy, sourceDesc) {
      const accText = accuracy ? ' (±' + Math.round(accuracy) + 'm)' : '';
      const popupHtml =
        '<div class="user-location-popup">' +
        '<strong>📍 Your Location</strong>' + accText + '<br>' +
        '<span style="font-size:11px;color:#5f6368;">' + (sourceDesc || 'Detected GPS Location') + '</span><br>' +
        '<small style="display:inline-block;margin-top:4px;color:#1a73e8;font-weight:600;">✋ Drag pin to fine-tune starting point</small>' +
        '</div>';

      if (userLocationMarker) {
        userLocationMarker.setLatLng(latlng);
        userLocationMarker.setPopupContent(popupHtml);
      } else {
        const userLocIcon = L.divIcon({
          className: 'user-device-location-icon',
          html: '<div class="user-radar-pulse"></div><div class="user-pin-circle">📍</div>',
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        });

        userLocationMarker = L.marker(latlng, {
          icon: userLocIcon,
          draggable: true,
          zIndexOffset: 1200
        }).addTo(map).bindPopup(popupHtml);

        userLocationMarker.on('dragend', function (ev) {
          const pos = ev.target.getLatLng();
          userDeviceCoords = [pos.lng, pos.lat];
          routeOrigin = userDeviceCoords;
          if (sourceInput) sourceInput.value = 'My device location';
          setLocationStatus('Using adjusted location pin (' + pos.lat.toFixed(4) + '° N, ' + pos.lng.toFixed(4) + '° E).');
          broadcastUserEmergencyActivity('location_update', {
            lat: pos.lat,
            lng: pos.lng,
            coords: pos.lat.toFixed(4) + '° N, ' + pos.lng.toFixed(4) + '° E',
            actionDescription: 'Caller adjusted position pin on map'
          });
          if (destinationInput && destinationInput.value.trim()) {
            searchDestination(destinationInput.value.trim());
          }
        });
      }
    }

    function applyDetectedLocation(coords, accuracy, sourceDesc, options) {
      options = options || {};
      userDeviceCoords = coords;
      routeOrigin = userDeviceCoords;
      if (useMyLocationBtn) useMyLocationBtn.classList.remove('locating-spin');
      if (sourceInput) sourceInput.value = 'My device location';

      renderUserLocationMarker([coords[1], coords[0]], accuracy, sourceDesc);

      if (options.setView || options.userInitiated) {
        if (!userManualZoomActive) {
          map.setView([coords[1], coords[0]], 15);
        } else {
          map.panTo([coords[1], coords[0]]);
        }
      }

      setLocationStatus('Using ' + sourceDesc + ' as starting point.');

      broadcastUserEmergencyActivity('location_update', {
        lat: coords[1],
        lng: coords[0],
        coords: coords[1].toFixed(4) + '° N, ' + coords[0].toFixed(4) + '° E',
        actionDescription: 'Caller position updated (' + sourceDesc + ')'
      });

      if (options.autoSearch && destinationInput && destinationInput.value.trim()) {
        searchDestination(destinationInput.value.trim());
      }
    }

    async function requestDeviceLocation(options) {
      options = options || {};
      const isUserInitiated = !!options.userInitiated;

      if (isUserInitiated) {
        if (useMyLocationBtn) useMyLocationBtn.classList.add('locating-spin');
        if (sourceInput && (!sourceInput.value || /finding|detecting/i.test(sourceInput.value))) {
          sourceInput.value = 'Detecting device location...';
        }
        setLocationStatus('Detecting device location...');
      }

      let resolved = false;

      function resolveSuccess(coords, accuracy, desc) {
        if (resolved) return;
        resolved = true;
        applyDetectedLocation(coords, accuracy, desc, options);
      }

      function resolveFailure(reason) {
        if (resolved) return;
        resolved = true;
        if (useMyLocationBtn) useMyLocationBtn.classList.remove('locating-spin');
        if (isUserInitiated) {
          if (sourceInput && /detecting/i.test(sourceInput.value)) {
            sourceInput.value = '';
          }
          const msg = reason || 'Device location is not enabled. Please enable location permissions on your device to detect your position.';
          setLocationStatus(msg);
          setStatus(msg);
        } else {
          console.info('Device location not enabled on startup; remaining at default local position.');
        }
      }

      // Check browser Geolocation API - rely strictly on device geolocation enabled by user
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          function (pos) {
            if (pos && pos.coords && Number.isFinite(pos.coords.latitude) && Number.isFinite(pos.coords.longitude)) {
              resolveSuccess([pos.coords.longitude, pos.coords.latitude], pos.coords.accuracy, 'Device GPS Location');
            } else {
              resolveFailure('Invalid coordinates received from device.');
            }
          },
          function (err1) {
            console.warn('High-accuracy GPS failed or timed out, trying standard accuracy:', err1.message);
            navigator.geolocation.getCurrentPosition(
              function (pos2) {
                if (pos2 && pos2.coords && Number.isFinite(pos2.coords.latitude) && Number.isFinite(pos2.coords.longitude)) {
                  resolveSuccess([pos2.coords.longitude, pos2.coords.latitude], pos2.coords.accuracy, 'Device Network Location');
                } else {
                  resolveFailure('Invalid coordinates received from device.');
                }
              },
              function (err2) {
                console.warn('Device geolocation not enabled or unavailable:', err2.message);
                let errorMsg = 'Device location is not enabled. Please enable location on your device to detect your position.';
                if (err2 && err2.code === 1) {
                  errorMsg = 'Location permission denied. Please allow location access in your browser or device settings.';
                } else if (err2 && err2.code === 2) {
                  errorMsg = 'Device location is currently unavailable. Please verify GPS or network location is enabled.';
                } else if (err2 && err2.code === 3) {
                  errorMsg = 'Location request timed out. Please verify device location is enabled.';
                }
                resolveFailure(errorMsg);
              },
              { enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 }
            );
          },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 30000 }
        );
      } else {
        resolveFailure('Geolocation is not supported by your browser.');
      }
    }
    let hasUserInteracted = false;
    let isSidebarExpanded = false;
    let serviceDetailsRequestId = 0;
    let selectedServiceCoordinates = null;
    let isAssistanceSearch = false;
    let emergencySearchType = null;
    let destinationMarker = null;
    let isSearching = false;
    let searchRequestId = 0;
    let serviceRefreshTimer = null;
    let serviceRequestId = 0;
    let serviceRequestController = null;
    emergencyAssistance.querySelectorAll('[data-emergency-type]').forEach(function (button) {
      button.addEventListener('click', function () {
        const type = button.dataset.emergencyType;
        if (button.classList.contains('active')) {
          // De-select option when clicked again
          button.classList.remove('active');
          emergencySearchType = null;
          isAssistanceSearch = false;
          const situationSelector = document.getElementById('responder-situation-selector');
          if (situationSelector) situationSelector.hidden = true;
          const assistanceResults = document.getElementById('emergency-assistance-results');
          if (assistanceResults) {
            assistanceResults.hidden = true;
            assistanceResults.replaceChildren();
          }
          const responderBanner = document.getElementById('responder-dispatch-banner');
          if (responderBanner) {
            responderBanner.hidden = true;
            responderBanner.innerHTML = '';
          }
          const emergencyResultsList = document.getElementById('emergency-results-list');
          if (emergencyResultsList) {
            emergencyResultsList.hidden = true;
            emergencyResultsList.replaceChildren();
          }
          const emergencyStatusEl = document.getElementById('emergency-status-text');
          if (emergencyStatusEl) {
            emergencyStatusEl.textContent = 'Select an emergency service type below to find the nearest facilities.';
          }
          const emergencyOpenChat = document.getElementById('emergency-open-chat');
          if (emergencyOpenChat) emergencyOpenChat.hidden = false;
          routeLayers.clearLayers();

          broadcastUserEmergencyActivity('service_deselected', {
            serviceType: null,
            actionDescription: 'De-selected emergency service (Standby)'
          });
          if (destinationMarker) {
            map.removeLayer(destinationMarker);
            destinationMarker = null;
          }
          setStatus('');
        } else {
          findFastestEmergencyService(type);
        }
      });
    });


    emergencyOpenButton.addEventListener('click', function () {
      if (emergencyAssistance.hidden) {
        showNearbyEmergencyServices();
      } else {
        collapseSidebar();
      }
    });
    const emergencyAssistanceClose = document.getElementById('emergency-assistance-close');
    if (emergencyAssistanceClose) {
      emergencyAssistanceClose.addEventListener('click', function () {
        if (typeof collapseEmergencyServicePanel === 'function') {
          collapseEmergencyServicePanel();
        } else {
          collapseSidebar({ keepRoutes: true });
        }
      });
    }

    const emergencyAssistanceCollapseBtn = document.getElementById('emergency-assistance-collapse-btn');
    if (emergencyAssistanceCollapseBtn) {
      emergencyAssistanceCollapseBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        collapseEmergencyServicePanel();
      });
    }

    const routeToggleOptionsBtn = document.getElementById('route-toggle-options-btn');
    if (routeToggleOptionsBtn) {
      routeToggleOptionsBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (emergencyAssistance && !emergencyAssistance.hidden) {
          collapseEmergencyServicePanel();
        } else {
          showNearbyEmergencyServices();
        }
      });
    }
    if (emergencyAssistance) {
      emergencyAssistance.addEventListener('click', function (e) {
        const rect = emergencyAssistance.getBoundingClientRect();
        if (e.clientY - rect.top < 30 && !e.target.closest('button, a, input, select')) {
          collapseSidebar();
        }
      });
    }
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        collapseSidebar();
        if (assistanceChatBox && !assistanceChatBox.hidden) {
          closeAssistanceChat();
        }
      }
    });

    // --- Assistance Chat Box Controller ---
    const assistanceChatBox = document.getElementById('assistance-chatbox');
    const assistanceChatFloatingBtn = document.getElementById('assistance-chat-floating-btn');
    const chatboxMessages = document.getElementById('chatbox-messages');
    const chatboxQuickChips = document.getElementById('chatbox-quick-chips');
    const chatboxInputForm = document.getElementById('chatbox-input-form');
    const chatboxInput = document.getElementById('chatbox-input');
    const chatboxCloseBtn = document.getElementById('chatbox-close');
    const chatboxMinBtn = document.getElementById('chatbox-minimize');
    const emergencyOpenChat = document.getElementById('emergency-open-chat');
    let currentChatFacilityContext = null;

    function openAssistanceChat(facilityContext) {
      currentChatFacilityContext = facilityContext || null;
      document.body.classList.add('chat-open');
      document.body.classList.remove('emergency-panel-open');
      if (emergencyOpenButton) {
        emergencyOpenButton.hidden = true;
      }
      if (emergencyAssistance) {
        emergencyAssistance.hidden = true;
      }
      if (assistanceChatBox) {
        assistanceChatBox.hidden = false;
        if (assistanceChatFloatingBtn) assistanceChatFloatingBtn.hidden = true;
        if (chatboxInput) chatboxInput.focus();
      }

      if (facilityContext && facilityContext.name) {
        let facilityType = (facilityContext && facilityContext.type) || emergencySearchType || null;
        if (!facilityType && facilityContext) {
          const cat = ((facilityContext.category || '') + ' ' + (facilityContext.name || '')).toLowerCase();
          if (/police|pnp|precinct|patrol|law enforcement/i.test(cat)) {
            facilityType = 'police';
          } else if (/fire|bfp|fireman|firefighter/i.test(cat)) {
            facilityType = 'fire';
          } else if (/rescue|responder|drrmo|disaster|coast guard|mddrmo|pdrrmo|cdrrmo/i.test(cat)) {
            facilityType = 'responder';
          } else {
            facilityType = 'ambulance';
          }
        }

        const actions = [];
        if (facilityType === 'police') {
          actions.push({
            label: '🚓 Request Police Unit',
            emergency: true,
            action: function () {
              appendUserMessage('Request a Police Unit');
              handleChatIntent('police', 'Requesting police assistance at ' + facilityContext.name);
            }
          });
        } else if (facilityType === 'fire') {
          actions.push({
            label: '🚒 Request Fire Engine',
            emergency: true,
            action: function () {
              appendUserMessage('Request a Fire Responder');
              handleChatIntent('fire', 'Requesting fire responder at ' + facilityContext.name);
            }
          });
        } else if (facilityType === 'responder') {
          actions.push({
            label: '🛟 Request Rescue Team',
            emergency: true,
            action: function () {
              appendUserMessage('Request Rescue Responder');
              handleChatIntent('responder', 'Requesting rescue responder at ' + facilityContext.name);
            }
          });
        } else {
          actions.push({
            label: '🚑 Request Ambulance',
            emergency: true,
            action: function () {
              appendUserMessage('Request Ambulance');
              handleChatIntent('ambulance', 'Requesting ambulance assistance at ' + facilityContext.name);
            }
          });
        }

        actions.push({
          label: '🗺️ Route to Facility',
          action: function () {
            appendUserMessage('Route to ' + facilityContext.name);
            displayFacilityRouteInChat(facilityContext);
          }
        });

        if (facilityContext.phone) {
          actions.push({
            label: '📞 Call ' + facilityContext.phone,
            href: 'tel:' + facilityContext.phone.replace(/[^\d+*#;]/g, '')
          });
        }

        actions.push({
          label: 'ℹ️ Bay Ingress & Triage',
          action: function () {
            appendUserMessage('What are the triage and ingress access details for ' + facilityContext.name + '?');
            appendBotMessage(
              '🏥 <strong>Facility Ingress & Access Profile: ' + escapeHtml(facilityContext.name) + '</strong><br>' +
              '• <strong>Address:</strong> ' + escapeHtml(facilityContext.address || 'Verified facility zone') + '<br>' +
              '• <strong>Ingress:</strong> Priority emergency bay clearance; ambulances & emergency vehicles have dedicated driveway access.<br>' +
              '• <strong>Readiness:</strong> 24/7 on-call triage staff and radio-linked emergency reception.<br>' +
              '• <strong>Hotline:</strong> ' + escapeHtml(facilityContext.phone || '911'),
              [
                {
                  label: '🗺️ Route There Now',
                  action: function () {
                    appendUserMessage('Route to ' + facilityContext.name);
                    displayFacilityRouteInChat(facilityContext);
                  }
                },
                (facilityContext.phone ? { label: '📞 Call Hotline', href: 'tel:' + facilityContext.phone.replace(/[^\d+*#;]/g, '') } : null)
              ].filter(Boolean)
            );
          }
        });

        actions.push({
          label: '☎️ All 911 Hotlines',
          action: function () { handleChatIntent('hotlines'); }
        });

        appendBotMessage(
          '🚨 <strong>Facility Selected: ' + escapeHtml(facilityContext.name) + '</strong><br>' +
          '<em>' + escapeHtml(facilityContext.category || 'Emergency Facility') + '</em><br><br>' +
          'What emergency assistance do you need with this facility right now?<br>' +
          'Select a quick action below or type your question in the chatbox:',
          actions
        );
      } else {
        // Greet and ask what the user needs with comprehensive emergency buttons
        const lastMsgTime = assistanceChatBox.dataset.lastPromptTime ? parseInt(assistanceChatBox.dataset.lastPromptTime, 10) : 0;
        const now = Date.now();
        if (!chatboxMessages || chatboxMessages.children.length === 0 || (now - lastMsgTime > 45000)) {
          assistanceChatBox.dataset.lastPromptTime = String(now);
          displayEmergencyAssistanceDispatchMenu();
        }
      }
      renderChatQuickChips();
    }

    function closeAssistanceChat() {
      document.body.classList.remove('chat-open');
      if (assistanceChatBox) assistanceChatBox.hidden = true;
      if (assistanceChatFloatingBtn) assistanceChatFloatingBtn.hidden = false;
      if (emergencyOpenButton) {
        if (!emergencyAssistance || emergencyAssistance.hidden) {
          emergencyOpenButton.hidden = false;
        } else {
          emergencyOpenButton.hidden = true;
        }
      }
    }

    function endAssistanceChat(reason) {
      appendBotMessage(
        '👋 <strong>Assistance Ended:</strong><br>' +
        (reason || 'Understood. Closing emergency assistance. Stay safe! You can reopen this chat anytime by tapping the emergency button.')
      );
      setTimeout(function () {
        closeAssistanceChat();
      }, 1000);
    }

    function appendUserMessage(text) {
      if (!chatboxMessages) return;
      const msg = document.createElement('div');
      msg.className = 'chat-msg user';
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      msg.innerHTML = '<div class="chat-msg-bubble">' + escapeHtml(text) + '</div>' +
        '<div class="chat-msg-time">' + timeStr + '</div>';
      chatboxMessages.appendChild(msg);
      chatboxMessages.scrollTop = chatboxMessages.scrollHeight;
    }

    function displayDoctorSpecialtiesChatMenu() {
      appendBotMessage(
        '🩺 <strong>Doctor Specialization (Nearest Specialist):</strong><br>' +
        'Select a doctor specialization below to locate the nearest verified hospitals and specialty clinics with real-time distance and driving ETA:',
        [
          { label: '👶 Pediatrics (Pedia / Child Care)', action: function () { answerUserEmergencyQuestion('pedia'); } },
          { label: '🫀 Cardiology (Cardio / Heart Care)', action: function () { answerUserEmergencyQuestion('cardio'); } },
          { label: '👂 ENT (Ear, Nose & Throat)', action: function () { answerUserEmergencyQuestion('ent'); } },
          { label: '🤰 OB-GYN (Maternity & Obstetrics)', action: function () { answerUserEmergencyQuestion('ob-gyn'); } },
          { label: '🦴 Orthopedics (Bone & Joint)', action: function () { answerUserEmergencyQuestion('ortho'); } },
          { label: '🧠 Neurology & Neurosurgery (Brain & Spine)', action: function () { answerUserEmergencyQuestion('neuro'); } },
          { label: '🫁 Pulmonology (Lung & Respiratory)', action: function () { answerUserEmergencyQuestion('pulmo'); } },
          { label: '👁️ Ophthalmology (Eye Care)', action: function () { answerUserEmergencyQuestion('eye doctor'); } },
          { label: '🧴 Dermatology (Skin Care)', action: function () { answerUserEmergencyQuestion('derma'); } },
          { label: '🩺 Gastroenterology (Digestive)', action: function () { answerUserEmergencyQuestion('gastro'); } },
          { label: '🩸 Nephrology (Kidney & Dialysis)', action: function () { answerUserEmergencyQuestion('nephro'); } },
          { label: '⚕️ General & Trauma Surgery', action: function () { answerUserEmergencyQuestion('surgery'); } }
        ]
      );
    }

    function displaySpecializedFacilitiesChatMenu() {
      appendBotMessage(
        '🏥 <strong>Immediate Specialized Facilities:</strong><br>' +
        'Select an immediate emergency service category below to view all verified nearby facilities ranked by proximity:',
        [
          { label: '🧠 Mental Health & Crisis Services', action: function () { answerUserEmergencyQuestion('mental health'); } },
          { label: '🩺 Clinics & Health Centers', action: function () { answerUserEmergencyQuestion('clinic'); } },
          { label: '♿ Nursing, Care & Rehabilitation', action: function () { answerUserEmergencyQuestion('rehab'); } },
          { label: '💊 Pharmacies & Diagnostic Labs', action: function () { answerUserEmergencyQuestion('pharmacy'); } }
        ]
      );
    }

    function displayEmergencyAssistanceDispatchMenu() {
      appendBotMessage(
        '👋 <strong>Emergency Assistance & 24/7 Dispatch</strong><br>' +
        'Hello! What emergency assistance or route information do you need right now?<br><br>' +
        'Please choose an emergency service below, or ask any question in the chatbox:',
        [
          { label: '🚑 Medical / Ambulance', emergency: true, action: function () { handleChatIntent('ambulance'); } },
          { label: '🩺 Doctor Specialization (Nearest Specialist)', emergency: true, action: function () { displayDoctorSpecialtiesChatMenu(); } },
          { label: '🏥 Immediate Specialized Facilities', action: function () { displaySpecializedFacilitiesChatMenu(); } },
          { label: '🚓 Police Assistance', emergency: true, action: function () { handleChatIntent('police'); } },
          { label: '🚒 Fire & Rescue', emergency: true, action: function () { handleChatIntent('fire'); } },
          { label: '🛟 Flood / Water Rescue', action: function () { handleChatIntent('responder-scenario:flood'); } },
          { label: '📍 My Current Location', action: function () { handleChatIntent('my_location'); } },
          { label: '🛣️ Live Road Conditions & Traffic', action: function () { handleChatIntent('traffic_conditions'); } },
          { label: '☎️ 911 Emergency Hotlines', action: function () { handleChatIntent('hotlines'); } },
          { label: '🩹 First Aid Quick Guide', action: function () { handleChatIntent('first_aid'); } }
        ]
      );
    }

    function appendBotMessage(htmlContent, actions) {
      if (!chatboxMessages) return;
      const msg = document.createElement('div');
      msg.className = 'chat-msg bot';
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Automatically include "Emergency Assistance & 24/7 Dispatch" return option on any opened choices
      let effectiveActions = Array.isArray(actions) ? actions.slice() : [];
      const isDispatchMenu = Boolean(htmlContent && (
        htmlContent.includes('Emergency Assistance & 24/7 Dispatch') ||
        htmlContent.includes('How can we assist your emergency or navigation needs right now') ||
        htmlContent.includes('Assistance Ended')
      ));
      const hasBackToDispatch = effectiveActions.some(function (act) {
        return act && act.label && (act.label.includes('Emergency Assistance') || act.label.includes('24/7 Dispatch'));
      });

      if (!isDispatchMenu && !hasBackToDispatch && effectiveActions.length > 0) {
        effectiveActions.push({
          label: '🔙 Emergency Assistance & 24/7 Dispatch',
          secondary: true,
          action: function () {
            appendUserMessage('Emergency Assistance & 24/7 Dispatch');
            displayEmergencyAssistanceDispatchMenu();
          }
        });
      }

      let actionsHtml = '';
      if (effectiveActions.length > 0) {
        actionsHtml = '<div class="chat-msg-actions">';
        effectiveActions.forEach(function (act, idx) {
          if (act.href) {
            actionsHtml += '<a href="' + escapeHtml(act.href) + '" class="chat-action-btn secondary' + (act.emergency ? ' emergency' : '') + '">' + escapeHtml(act.label) + '</a>';
          } else {
            actionsHtml += '<button type="button" class="chat-action-btn' + (act.emergency ? ' emergency' : (act.secondary ? ' secondary' : '')) + '" data-action-idx="' + idx + '">' + escapeHtml(act.label) + '</button>';
          }
        });
        actionsHtml += '</div>';
      }

      msg.innerHTML = '<div class="chat-msg-bubble">' + htmlContent + actionsHtml + '</div>' +
        '<div class="chat-msg-time">' + timeStr + ' • Assistant</div>';

      if (effectiveActions.length > 0) {
        msg.querySelectorAll('button[data-action-idx]').forEach(function (btn) {
          const idx = parseInt(btn.dataset.actionIdx, 10);
          if (effectiveActions[idx] && typeof effectiveActions[idx].action === 'function') {
            btn.addEventListener('click', effectiveActions[idx].action);
          }
        });
      }

      chatboxMessages.appendChild(msg);
      chatboxMessages.scrollTop = chatboxMessages.scrollHeight;
    }

    function activateEmergencyRouteFromChat(facilityName, coordinates, facilityData, emergencyType) {
      lastEmergencyActionTime = Date.now();
      isSearching = false;
      try {
        localStorage.removeItem('responder_cleared_time');
      } catch (e) {}

      if (destinationInput) {
        destinationInput.value = facilityName;
      }

      const fType = emergencyType || (facilityData && facilityData.type) || 'ambulance';
      const fData = facilityData || { name: facilityName, coordinates: coordinates, type: fType };
      searchDestination(facilityName, coordinates, { emergencyType: fType, facility: fData });

      const distKm = (fData && fData.distanceMeters)
        ? (fData.distanceMeters / 1000).toFixed(1)
        : (fData && fData.stats && fData.stats.distKm)
          ? fData.stats.distKm
          : '1.5';
      const estMins = (fData && fData.durationMins)
        ? fData.durationMins
        : (fData && fData.stats && fData.stats.etaMins)
          ? fData.stats.etaMins
          : 3;

      showEmergencyRouteConfirmationBar({
        name: facilityName,
        category: (fData && (fData.category || fData.services)) || 'Emergency Facility',
        distKm: distKm,
        durationMins: estMins,
        coordinates: coordinates,
        phone: (fData && fData.phone) || '',
        type: fType
      }, false);

      // On mobile viewports, close chat sheet so the route path on the map is immediately visible
      if (window.innerWidth <= 640) {
        closeAssistanceChat();
        collapseSidebar();
        document.body.classList.add('mobile-route-active');
        if (serviceDetails) {
          serviceDetails.hidden = true;
          serviceDetails.replaceChildren();
        }
      }

      setTimeout(function () {
        if (typeof routeLayers !== 'undefined' && routeLayers.getBounds && routeLayers.getBounds().isValid()) {
          fitMapBoundsSafely(routeLayers.getBounds(), true);
        }
      }, 500);
    }

    function displayFacilityRouteInChat(facilityContext, customOptions) {
      if (!facilityContext) return;

      // 1. Resolve full facility details
      let facility = facilityContext;
      const searchName = (facility.name || '').trim().toLowerCase();
      const matched = (typeof KNOWN_EMERGENCY_FACILITIES !== 'undefined' && Array.isArray(KNOWN_EMERGENCY_FACILITIES))
        ? KNOWN_EMERGENCY_FACILITIES.find(function (f) {
            const lower = f.name.toLowerCase();
            return lower === searchName || lower.includes(searchName) || (searchName.length > 5 && searchName.includes(lower));
          })
        : null;

      if (matched) {
        facility = Object.assign({}, matched, facility);
      }

      const facilityName = facility.name || 'Emergency Facility';
      const facilityCategory = facility.category || 'Emergency Care & Ingress Facility';
      const facilityAddress = facility.address || 'Iloilo City Metropolitan Area';
      const facilityPhone = facility.phone || '';
      const facilityType = facility.type || 'ambulance';

      // 2. Resolve origin point from detected position
      const userLoc = typeof getDetectedUserLocation === 'function' ? getDetectedUserLocation() : null;
      const originCoords = (userLoc && userLoc.coords) || (typeof userDeviceCoords !== 'undefined' && userDeviceCoords) || (typeof routeOrigin !== 'undefined' && routeOrigin) || (typeof initialCenter !== 'undefined' && initialCenter) || [122.5368, 10.7196];
      const originPoint = L.latLng(originCoords[1], originCoords[0]);

      let destCoords = facility.coordinates;
      if (!destCoords && matched && matched.coordinates) {
        destCoords = matched.coordinates;
      }
      if (!destCoords && typeof KNOWN_PLACES !== 'undefined') {
        const kp = KNOWN_PLACES.find(function (p) { return p.name.toLowerCase().includes(facilityName.toLowerCase()); });
        if (kp) destCoords = kp.coordinates;
      }
      if (!destCoords) {
        destCoords = [122.5412, 10.6953]; // fallback coordinates (Medical City area)
      }

      const destPoint = L.latLng(destCoords[1], destCoords[0]);
      const straightDistanceM = Math.round(originPoint.distanceTo(destPoint));
      const roadDistanceM = Math.max(500, Math.round(straightDistanceM * 1.28));
      const roadDistKm = (roadDistanceM / 1000).toFixed(1);

      // 3. Compute factor-aware travel time breakdown
      // Base time at nominal free-flow speed (38 km/h city corridor)
      const baseMinutes = Math.max(2, Math.round((roadDistanceM / 1000) / 38 * 60));

      // Traffic delay multiplier on active corridors (Diversion Rd, Gen. Luna, etc.)
      let trafficDelayMin = Math.max(1, Math.round(baseMinutes * 0.40));
      if (parseFloat(roadDistKm) > 4.0) trafficDelayMin = Math.max(2, Math.round(baseMinutes * 0.50));

      // Spatial hazard buffers (floods/caution zones)
      const activeHazardsCount = (typeof liveIncidents !== 'undefined' && Array.isArray(liveIncidents)) ? liveIncidents.length : 0;
      const hazardDelayMin = activeHazardsCount > 0 ? Math.min(3, Math.max(1, Math.round(activeHazardsCount * 0.7))) : 0;

      // Intersections and turn maneuvers (~18s delay per turn)
      const estTurns = Math.max(3, Math.round(parseFloat(roadDistKm) * 1.8));
      const turnDelayMin = Math.max(1, Math.round((estTurns * 18) / 60));

      // Net travel time
      const totalEtaMin = baseMinutes + trafficDelayMin + hazardDelayMin + turnDelayMin;

      // 4. Trigger active route computation on Leaflet map in background
      try {
        localStorage.removeItem('responder_cleared_time');
      } catch (e) {}
      if (typeof destinationInput !== 'undefined' && destinationInput) {
        destinationInput.value = facilityName;
      }
      if (typeof searchDestination === 'function') {
        searchDestination(facilityName, destCoords, { emergencyType: facilityType, facility: facility });
      }
      showEmergencyRouteConfirmationBar({
        name: facilityName,
        category: facilityCategory,
        distKm: roadDistKm,
        durationMins: totalEtaMin,
        coordinates: destCoords,
        phone: facilityPhone,
        type: facilityType
      }, false);

      // 5. Construct rich HTML response with factors, metrics, and actions
      const fTypeIcon = (facilityType === 'police') ? '🚓' : (facilityType === 'fire' ? '🚒' : (facilityType === 'responder' ? '🛟' : '🏥'));

      const factorHtml =
        fTypeIcon + ' <strong>Fastest Factor-Aware Route to ' + escapeHtml(facilityName) + '</strong><br>' +
        '<em>' + escapeHtml(facilityCategory) + '</em><br><br>' +

        '<div class="chat-factor-card">' +
          '<div style="font-weight: 700; font-size: 11.5px; margin-bottom: 4px; color: #1a73e8;">📊 Real-Time Navigation Summary</div>' +
          '<div class="chat-factor-grid">' +
            '<div class="chat-factor-tile"><span class="tile-title">Overall Travel Time</span><span class="tile-val">~' + totalEtaMin + ' mins</span></div>' +
            '<div class="chat-factor-tile"><span class="tile-title">Total Distance</span><span class="tile-val">' + roadDistKm + ' km</span></div>' +
            '<div class="chat-factor-tile"><span class="tile-title">Base Free-Flow</span><span class="tile-val">' + baseMinutes + ' mins</span></div>' +
            '<div class="chat-factor-tile delay"><span class="tile-title">Factor Delays</span><span class="tile-val">+' + (trafficDelayMin + hazardDelayMin + turnDelayMin) + ' mins</span></div>' +
          '</div>' +
          '<div style="font-size: 11px; color: #5f6368; line-height: 1.4;">' +
            '📍 <strong>Address:</strong> ' + escapeHtml(facilityAddress) + '<br>' +
            '🚑 <strong>Ingress:</strong> Dedicated rapid triage emergency bay clearance.<br>' +
            (facilityPhone ? '📞 <strong>24/7 Hotline:</strong> ' + escapeHtml(facilityPhone) + '<br>' : '') +
          '</div>' +
        '</div><br>' +

        '⏱️ <strong>Conditions Affecting Overall Travel Time:</strong><br>' +
        '1. <strong>Live Traffic Congestion:</strong> ' + (trafficDelayMin > 0 ? 'Bottlenecks & corridor queueing adds <strong>+' + trafficDelayMin + ' min delay</strong>.' : 'Free-flow traffic conditions (0 min delay).') + '<br>' +
        '2. <strong>Corridor Hazards:</strong> ' + (hazardDelayMin > 0 ? 'Active flood caution buffers evaluated = <strong>+' + hazardDelayMin + ' min detour</strong>.' : 'No active impassable floods detected along corridor (<strong>0 min</strong>).') + '<br>' +
        '3. <strong>Intersection Maneuvers:</strong> ' + estTurns + ' turning maneuvers and signalized crossings (~' + turnDelayMin + ' min deceleration).<br>' +
        '4. <strong>Road Surface Grip:</strong> Standard asphalt friction coefficient (μ ≈ 0.82) under nominal dry conditions.<br><br>' +

        '<em>The route line and turn-by-turn maneuvers have been plotted on the map. Click below to inspect the full route:</em>';

      const actions = [
        {
          label: '🗺️ View Route on Map',
          emergency: true,
          action: function () {
            closeAssistanceChat();
            expandSidebar();
            if (typeof routeLayers !== 'undefined' && routeLayers.getBounds && routeLayers.getBounds().isValid()) {
              fitMapBoundsSafely(routeLayers.getBounds(), true);
            }
          }
        }
      ];

      if (facilityPhone) {
        actions.push({
          label: '📞 Call ' + facilityPhone,
          href: 'tel:' + facilityPhone.replace(/[^\d+*#;]/g, '')
        });
      }

      actions.push({
        label: '🚨 Call 911',
        href: 'tel:911',
        emergency: true
      });

      actions.push({
        label: 'ℹ️ Bay Ingress & Triage Profile',
        action: function () {
          appendUserMessage('What are the triage and ingress access details for ' + facilityName + '?');
          appendBotMessage(
            '🏥 <strong>Facility Ingress & Access Profile: ' + escapeHtml(facilityName) + '</strong><br>' +
            '• <strong>Address:</strong> ' + escapeHtml(facilityAddress) + '<br>' +
            '• <strong>Emergency Ingress:</strong> Dedicated rapid-triage ambulance bay with priority driveway clearance.<br>' +
            '• <strong>Emergency Readiness:</strong> 24/7 on-call trauma surgeons, acute resuscitation team, and radio-linked ER reception.<br>' +
            '• <strong>Hotline:</strong> ' + escapeHtml(facilityPhone || '911'),
            [
              {
                label: '🗺️ View Route on Map',
                emergency: true,
                action: function () {
                  closeAssistanceChat();
                  if (window.innerWidth <= 640) {
                    collapseSidebar();
                    document.body.classList.add('mobile-route-active');
                    if (serviceDetails) { serviceDetails.hidden = true; serviceDetails.replaceChildren(); }
                  } else {
                    expandSidebar();
                  }
                  if (typeof routeLayers !== 'undefined' && routeLayers.getBounds && routeLayers.getBounds().isValid()) {
                    fitMapBoundsSafely(routeLayers.getBounds(), true);
                  }
                }
              },
              (facilityPhone ? { label: '📞 Call Hotline', href: 'tel:' + facilityPhone.replace(/[^\d+*#;]/g, '') } : null)
            ].filter(Boolean)
          );
        }
      });

      appendBotMessage(factorHtml, actions);
    }

    function renderChatQuickChips() {
      if (!chatboxQuickChips) return;
      chatboxQuickChips.innerHTML = '';
      const chips = [
        { label: '🏠 24/7 Dispatch', intent: 'dispatch' },
        { label: '🩺 Doctor Specialization', intent: 'specialties_menu' },
        { label: '🏥 Specialized Facilities', intent: 'specialized_facilities_menu' },
        { label: '🚑 Medical', intent: 'ambulance' },
        { label: '🚓 Police', intent: 'police' },
        { label: '🚒 Fire', intent: 'fire' },
        { label: '🛟 Rescue', intent: 'responder' },
        { label: '📍 My Location', intent: 'my_location' },
        { label: '🛣️ Road Traffic', intent: 'traffic_conditions' },
        { label: '☎️ 911 Hotlines', intent: 'hotlines' },
        { label: '🩹 First Aid', intent: 'first_aid' },
        { label: '⏱️ Travel Factors', intent: 'travel_factors' }
      ];
      chips.forEach(function (chip) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'chat-chip';
        btn.textContent = chip.label;
        btn.addEventListener('click', function () {
          appendUserMessage(chip.label);
          handleChatIntent(chip.intent);
        });
        chatboxQuickChips.appendChild(btn);
      });
    }

    function answerUserEmergencyQuestion(userText) {
      const q = (userText || '').trim().toLowerCase();
      const cleanQ = q.replace(/[.?!,]+$/, '').trim();

      // Check if user answered "no" to assistance or wants to end chat
      if (/^(?:no|nope|no thanks|no thank you|no need|none|nothing|wala|hindi|not now|not right now|im good|i'm good|all good|nah|cancel|end|end chat|close|close chat|stop|bye|goodbye)$/i.test(cleanQ)) {
        endAssistanceChat('Understood. Closing emergency assistance. Stay safe!');
        return;
      }

      // Check if caller answered/clicked confirm that there is an emergency
      if (/^(?:confirm|confirm emergency|yes confirm|yes,?\s*confirm|yes there is an emergency|there is an emergency|emergency confirmed|i confirm|confirmed|yes)$/i.test(cleanQ)) {
        if (currentEmergencyTarget) {
          confirmCurrentEmergencyRoute();
          appendBotMessage(
            '🚨 <strong>Emergency Confirmed!</strong><br>' +
            'Your active emergency has been verified and transmitted to 24/7 responders.<br>' +
            '• <strong>Target Facility:</strong> ' + escapeHtml(currentEmergencyTarget.name) + '<br>' +
            '• <strong>Status:</strong> Active emergency route live on map and dispatch systems.',
            [
              {
                label: '🗺️ View Active Route on Map',
                emergency: true,
                action: function () {
                  closeAssistanceChat();
                  if (window.innerWidth <= 640) {
                    collapseSidebar();
                    document.body.classList.add('mobile-route-active');
                    if (serviceDetails) { serviceDetails.hidden = true; serviceDetails.replaceChildren(); }
                  } else {
                    expandSidebar();
                  }
                  if (typeof routeLayers !== 'undefined' && routeLayers.getBounds && routeLayers.getBounds().isValid()) {
                    fitMapBoundsSafely(routeLayers.getBounds(), true);
                  }
                }
              },
              (currentEmergencyTarget.phone ? { label: '📞 Call Facility', href: 'tel:' + currentEmergencyTarget.phone.replace(/[^\d+*#;]/g, '') } : null),
              { label: '📞 Call 911', href: 'tel:911', emergency: true },
              {
                label: '🛑 Clear / End Emergency Route',
                secondary: true,
                action: function () {
                  clearEmergencyRoute();
                  appendBotMessage('🛑 <strong>Emergency Route Erased:</strong><br>The active emergency route has been cleared automatically from your map.');
                }
              }
            ].filter(Boolean)
          );
          return;
        } else {
          isCurrentEmergencyConfirmed = true;
          broadcastUserEmergencyActivity('emergency_confirmed', {
            actionDescription: 'Caller confirmed active emergency via chat'
          });
          appendBotMessage(
            '🚨 <strong>Emergency Confirmed!</strong><br>' +
            'Responders have been notified of your active emergency. Please select your required response service to plot the fastest route:',
            [
              { label: '🚑 Medical / Ambulance', emergency: true, action: function () { handleChatIntent('ambulance'); } },
              { label: '🚓 Police Assistance', emergency: true, action: function () { handleChatIntent('police'); } },
              { label: '🚒 Fire & Rescue', emergency: true, action: function () { handleChatIntent('fire'); } },
              { label: '🛟 Flood / Water Rescue', action: function () { handleChatIntent('responder-scenario:flood'); } },
              { label: '📞 Call 911 Hotline', href: 'tel:911', emergency: true }
            ]
          );
          return;
        }
      }

      // Check if caller wants to clear / erase the route path automatically
      if (/^(?:clear route|erase route|clear emergency|cancel route|erase the route|delete route|remove route|stop route)$/i.test(cleanQ)) {
        clearEmergencyRoute();
        appendBotMessage(
          '🛑 <strong>Emergency Route Erased:</strong><br>' +
          'The active route path and emergency status have been cleared automatically from your map on desktop and mobile.',
          [
            { label: '🏠 24/7 Dispatch Menu', action: function () { displayEmergencyAssistanceDispatchMenu(); } }
          ]
        );
        return;
      }
      const userLoc = typeof getDetectedUserLocation === 'function' ? getDetectedUserLocation() : {
        coords: [122.5368, 10.7196],
        lat: 10.7196,
        lng: 122.5368,
        districtName: 'Mandurriao District',
        formattedCoords: '10.7196° N, 122.5368° E',
        nearestLandmark: { streets: 'Benigno Aquino Ave / Guzman St' }
      };
      const originPoint = L.latLng(userLoc.lat, userLoc.lng);

      const getFacilityStats = function (facility) {
        const dM = Math.round(originPoint.distanceTo(L.latLng(facility.coordinates[1], facility.coordinates[0])));
        const etaMins = Math.max(1, Math.round((dM / 1000) / 32 * 60));
        return {
          distMeters: dM,
          distKm: (dM / 1000).toFixed(1),
          etaMins: etaMins
        };
      };

      // 0. Direct Destination / Route Request Check (e.g. "route to SM City", "how to get to festive walk", "directions to wvmc")
      const routeRequestMatch = q.match(/^(?:route\s+to|directions?\s+to|navigate\s+to|take\s+me\s+to|how\s+(?:do\s+i|to)\s+(?:get|go)\s+to|bring\s+me\s+to|go\s+to|drive\s+to|path\s+to)\s+(.+)/i);
      if (routeRequestMatch && routeRequestMatch[1]) {
        let targetPlace = routeRequestMatch[1].replace(/[?!.,]+$/, '').trim();
        if (targetPlace.length > 1) {
          const matchedFacility = KNOWN_EMERGENCY_FACILITIES.find(function (f) {
            const lowerF = f.name.toLowerCase();
            const lowerT = targetPlace.toLowerCase();
            return lowerF.includes(lowerT) || lowerT.includes(lowerF);
          });
          displayFacilityRouteInChat(matchedFacility || { name: targetPlace });
          return;
        }
      }

      // 1. Where am I / What is my location / Coordinates
      if (/where am i|what is my location|my position|current location|my coordinates|where i am|gps location|location coordinates/i.test(q)) {
        appendBotMessage(
          '📍 <strong>Your Current Detected Position:</strong><br>' +
          '• <strong>District / Area:</strong> ' + escapeHtml(userLoc.districtName) + '<br>' +
          '• <strong>GPS Coordinates:</strong> <code>' + escapeHtml(userLoc.formattedCoords) + '</code><br>' +
          '• <strong>Nearby Corridor:</strong> ' + escapeHtml((userLoc.nearestLandmark && userLoc.nearestLandmark.streets) || 'Iloilo City Road Network') + '<br>' +
          '• <strong>Location Source:</strong> ' + escapeHtml(userLoc.sourceName || 'GPS Fix') + '<br><br>' +
          'How can we assist you from this location?',
          [
            {
              label: '📍 Center Map Here',
              action: function () {
                map.setView([userLoc.lat, userLoc.lng], 16);
                appendBotMessage('Map view centered on your current detected position.');
              }
            },
            { label: '🚑 Nearest Hospital', action: function () { handleChatIntent('ambulance'); } },
            { label: '🚓 Nearest Police', action: function () { handleChatIntent('police'); } },
            { label: '🚒 Nearest Fire Dept', action: function () { handleChatIntent('fire'); } }
          ]
        );
        return;
      }

      // 2. Specific Named Facilities (e.g. WVMC, Doctors, St Pauls, Qualimed, Medicus, Mission, ICPO, BFP)
      const matchedKnown = KNOWN_EMERGENCY_FACILITIES.find(function (f) {
        const lowerName = f.name.toLowerCase();
        if (q.includes('wvmc') && lowerName.includes('wvmc')) return true;
        if (q.includes('doctor') && lowerName.includes('doctor')) return true;
        if (q.includes('paul') && lowerName.includes('paul')) return true;
        if (q.includes('qualimed') && lowerName.includes('qualimed')) return true;
        if (q.includes('medicus') && lowerName.includes('medicus')) return true;
        if (q.includes('mission') && lowerName.includes('mission')) return true;
        if (q.includes('red cross') && lowerName.includes('red cross')) return true;
        if ((q.includes('central fire') || q.includes('bfp central')) && lowerName.includes('central fire')) return true;
        if (q.includes('station 4') && lowerName.includes('station 4')) return true;
        return lowerName.split(' ').some(function (w) { return w.length > 5 && q.includes(w); });
      });

      if (matchedKnown && (/where|how far|distance|address|phone|contact|info|details|route|go to|take me/i.test(q) || q.length < 35)) {
        const stats = getFacilityStats(matchedKnown);
        appendBotMessage(
          '🏥 <strong>' + escapeHtml(matchedKnown.name) + '</strong><br>' +
          '• <strong>Specialty:</strong> ' + escapeHtml(matchedKnown.category) + '<br>' +
          '• <strong>Distance:</strong> ' + stats.distKm + ' km from your position (~' + stats.etaMins + ' min drive)<br>' +
          '• <strong>Physical Address:</strong> ' + escapeHtml(matchedKnown.address) + '<br>' +
          '• <strong>Direct 24/7 Hotline:</strong> ' + escapeHtml(matchedKnown.phone) + '<br>' +
          '• <strong>Emergency Ingress:</strong> Clear dedicated emergency bay with direct triage access.',
          [
            {
              label: '🗺️ Route There Now',
              emergency: true,
              action: function () {
                appendUserMessage('Route to ' + matchedKnown.name);
                displayFacilityRouteInChat(matchedKnown);
              }
            },
            {
              label: '📞 Call ' + matchedKnown.phone,
              href: 'tel:' + matchedKnown.phone.replace(/[^\d+*#;]/g, '')
            },
            {
              label: '🚑 Request Ambulance Dispatch',
              action: function () { handleChatIntent('ambulance'); }
            }
          ]
        );
        return;
      }

      // 2.4. Doctor Specialization Facility Query Handler (Pedia, ENT, Cardio, Ortho, Neuro, etc.)
      const matchedSpecialty = typeof matchDoctorSpecializationQuery === 'function' ? matchDoctorSpecializationQuery(q) : null;
      if (matchedSpecialty && typeof queryNearestFacilitiesByDoctorSpecialization === 'function') {
        const sortedFacilities = queryNearestFacilitiesByDoctorSpecialization(matchedSpecialty.id, originPoint);
        if (sortedFacilities && sortedFacilities.length > 0) {
          const nearest = sortedFacilities[0];
          let resultsHtml = matchedSpecialty.icon + ' <strong>Nearest ' + escapeHtml(matchedSpecialty.specialtyName) + ':</strong><br>' +
            'Specialist: <strong>' + escapeHtml(matchedSpecialty.doctorTitle) + '</strong><br>' +
            'Found <strong>' + sortedFacilities.length + ' verified nearby medical facilities</strong> with specialized ' + escapeHtml(matchedSpecialty.id.toUpperCase()) + ' departments:<br><br>';

          sortedFacilities.forEach(function (item, idx) {
            resultsHtml += '<strong>' + (idx + 1) + '. ' + escapeHtml(item.name) + '</strong><br>' +
              '• <strong>Department / Capability:</strong> ' + escapeHtml(item.departmentService) + '<br>' +
              '• <strong>Proximity:</strong> ' + item.distKm + ' km away (~' + item.etaMins + ' min drive)' + (idx === 0 ? ' — <strong style="color:#188038;">Nearest Specialist</strong>' : '') + '<br>' +
              '• <strong>Address:</strong> ' + escapeHtml(item.address) + '<br>' +
              '• <strong>Direct Hotline:</strong> ' + escapeHtml(item.phone) + '<br><br>';
          });

          resultsHtml += '<em>Select a quick action below to plot the fastest factor-aware route immediately:</em>';

          const actions = [
            {
              label: '🗺️ Route to ' + (nearest.name.length > 22 ? nearest.name.slice(0, 20) + '…' : nearest.name),
              emergency: true,
              action: function () {
                activateEmergencyRouteFromChat(nearest.name, nearest.coordinates, nearest.facility, nearest.facility.type || 'ambulance');
              }
            },
            {
              label: '📞 Call ' + nearest.phone,
              href: 'tel:' + nearest.phone.replace(/[^\d+*#;]/g, '')
            }
          ];

          if (sortedFacilities.length > 1) {
            const second = sortedFacilities[1];
            actions.push({
              label: '🗺️ Route to #2 ' + (second.name.length > 20 ? second.name.slice(0, 18) + '…' : second.name),
              action: function () {
                activateEmergencyRouteFromChat(second.name, second.coordinates, second.facility, second.facility.type || 'ambulance');
              }
            });
          }

          appendBotMessage(resultsHtml, actions);
          return;
        }
      }

      // 2.5. Service Categories Facility Query Handler (Mental Health, Clinics, Care/Rehab, Pharmacies, etc.)
      const matchedCategory = typeof matchServiceCategoryQuery === 'function' ? matchServiceCategoryQuery(q) : null;
      if (matchedCategory && typeof queryNearestFacilitiesByServiceCategory === 'function') {
        const sortedFacilities = queryNearestFacilitiesByServiceCategory(matchedCategory.id, originPoint);
        if (sortedFacilities && sortedFacilities.length > 0) {
          const nearest = sortedFacilities[0];
          let resultsHtml = matchedCategory.icon + ' <strong>Nearest ' + escapeHtml(matchedCategory.name) + ':</strong><br>' +
            'Found <strong>' + sortedFacilities.length + ' verified nearby facilities</strong> ready to provide immediate emergency services to your position:<br><br>';

          sortedFacilities.forEach(function (item, idx) {
            resultsHtml += '<strong>' + (idx + 1) + '. ' + escapeHtml(item.name) + '</strong><br>' +
              '• <strong>Category:</strong> ' + escapeHtml(item.category) + '<br>' +
              '• <strong>Proximity:</strong> ' + item.distKm + ' km away (~' + item.etaMins + ' min drive)' + (idx === 0 ? ' — <strong style="color:#188038;">Nearest Facility</strong>' : '') + '<br>' +
              '• <strong>Immediate Emergency Service:</strong> ' + escapeHtml(item.services) + '<br>' +
              '• <strong>Address:</strong> ' + escapeHtml(item.address) + '<br>' +
              '• <strong>Direct Hotline:</strong> ' + escapeHtml(item.phone) + '<br><br>';
          });

          resultsHtml += '<em>Select a quick action below to plot the fastest factor-aware route immediately:</em>';

          const actions = [
            {
              label: '🗺️ Route to ' + (nearest.name.length > 22 ? nearest.name.slice(0, 20) + '…' : nearest.name),
              emergency: true,
              action: function () {
                activateEmergencyRouteFromChat(nearest.name, nearest.coordinates, nearest.facility, nearest.facility.type || 'ambulance');
              }
            },
            {
              label: '📞 Call ' + nearest.phone,
              href: 'tel:' + nearest.phone.replace(/[^\d+*#;]/g, '')
            }
          ];

          if (matchedCategory.crisisLine) {
            actions.push({
              label: '🚨 Call ' + matchedCategory.crisisLine + ' (Crisis Line)',
              href: 'tel:' + matchedCategory.crisisLine.replace(/[^\d+*#;]/g, ''),
              emergency: true
            });
          }

          if (sortedFacilities.length > 1) {
            const second = sortedFacilities[1];
            actions.push({
              label: '🗺️ Route to #2 ' + (second.name.length > 20 ? second.name.slice(0, 18) + '…' : second.name),
              action: function () {
                activateEmergencyRouteFromChat(second.name, second.coordinates, second.facility, second.facility.type || 'ambulance');
              }
            });
          }

          appendBotMessage(resultsHtml, actions);
          return;
        }
      }

      // 3. Nearest Hospital / Medical Facility
      if (/nearest hospital|closest hospital|where.*hospital|which hospital|nearest clinic|closest clinic|medical facility|where can i get medical|hospital near me/i.test(q)) {
        const hospitals = KNOWN_EMERGENCY_FACILITIES.filter(function (f) { return f.type === 'ambulance'; })
          .map(function (f) { return { facility: f, stats: getFacilityStats(f) }; })
          .sort(function (a, b) { return a.stats.distMeters - b.stats.distMeters; });

        if (hospitals.length > 0) {
          const nearest = hospitals[0];
          const second = hospitals[1];
          const third = hospitals[2];

          appendBotMessage(
            '🏥 <strong>Closest Hospital to Your Position:</strong><br>' +
            '<strong>' + escapeHtml(nearest.facility.name) + '</strong> (' + escapeHtml(nearest.facility.category) + ')<br>' +
            '• <strong>Distance:</strong> ' + nearest.stats.distKm + ' km away (~' + nearest.stats.etaMins + ' min drive)<br>' +
            '• <strong>Address:</strong> ' + escapeHtml(nearest.facility.address) + '<br>' +
            '• <strong>24/7 Hotline:</strong> ' + escapeHtml(nearest.facility.phone) + '<br>' +
            '• <strong>Status:</strong> Open 24/7 · Emergency Room & Triage Bay Active.<br><br>' +
            '<em>Alternative nearby facilities:</em><br>' +
            (second ? '• ' + escapeHtml(second.facility.name) + ' (' + second.stats.distKm + ' km)<br>' : '') +
            (third ? '• ' + escapeHtml(third.facility.name) + ' (' + third.stats.distKm + ' km)' : ''),
            [
              {
                label: '🗺️ Route to ' + (nearest.facility.name.length > 20 ? nearest.facility.name.slice(0, 18) + '...' : nearest.facility.name),
                emergency: true,
                action: function () {
                  activateEmergencyRouteFromChat(nearest.facility.name, nearest.facility.coordinates, nearest.facility, 'ambulance');
                }
              },
              {
                label: '📞 Call ' + nearest.facility.phone,
                href: 'tel:' + nearest.facility.phone.replace(/[^\d+*#;]/g, '')
              },
              {
                label: '🚑 Dispatch Ambulance',
                action: function () { handleChatIntent('ambulance'); }
              }
            ]
          );
          return;
        }
      }

      // 4. Nearest Police Station / Precinct
      if (/nearest police|closest police|where.*police|pnp station|police precinct|law enforcement|police near me/i.test(q)) {
        const policeStations = KNOWN_EMERGENCY_FACILITIES.filter(function (f) { return f.type === 'police'; })
          .map(function (f) { return { facility: f, stats: getFacilityStats(f) }; })
          .sort(function (a, b) { return a.stats.distMeters - b.stats.distMeters; });

        if (policeStations.length > 0) {
          const nearest = policeStations[0];
          appendBotMessage(
            '🚓 <strong>Nearest Police Station / Precinct:</strong><br>' +
            '<strong>' + escapeHtml(nearest.facility.name) + '</strong><br>' +
            '• <strong>Distance:</strong> ' + nearest.stats.distKm + ' km away (~' + nearest.stats.etaMins + ' min)<br>' +
            '• <strong>Address:</strong> ' + escapeHtml(nearest.facility.address) + '<br>' +
            '• <strong>PNP Contact:</strong> ' + escapeHtml(nearest.facility.phone) + '<br>' +
            '• <strong>Operations:</strong> 24/7 Desk Officer On-Duty & Active Patrol Sector.',
            [
              {
                label: '🗺️ Route to Station',
                emergency: true,
                action: function () {
                  destinationInput.value = nearest.facility.name;
                  searchDestination(nearest.facility.name, nearest.facility.coordinates, { emergencyType: 'police', facility: nearest.facility });
                }
              },
              {
                label: '📞 Call ' + nearest.facility.phone,
                href: 'tel:' + nearest.facility.phone.replace(/[^\d+*#;]/g, '')
              },
              {
                label: '🚓 Request Police Dispatch',
                action: function () { handleChatIntent('police'); }
              },
              {
                label: '🚨 Call 911',
                href: 'tel:911',
                emergency: true
              }
            ]
          );
          return;
        }
      }

      // 5. Nearest Fire Station / BFP
      if (/nearest fire|closest fire|fire department|bfp station|fire station near me|where.*fire/i.test(q)) {
        const fireStations = KNOWN_EMERGENCY_FACILITIES.filter(function (f) { return f.type === 'fire'; })
          .map(function (f) { return { facility: f, stats: getFacilityStats(f) }; })
          .sort(function (a, b) { return a.stats.distMeters - b.stats.distMeters; });

        if (fireStations.length > 0) {
          const nearest = fireStations[0];
          appendBotMessage(
            '🚒 <strong>Nearest Fire Station / BFP Engine Unit:</strong><br>' +
            '<strong>' + escapeHtml(nearest.facility.name) + '</strong><br>' +
            '• <strong>Distance:</strong> ' + nearest.stats.distKm + ' km away (~' + nearest.stats.etaMins + ' min)<br>' +
            '• <strong>Address:</strong> ' + escapeHtml(nearest.facility.address) + '<br>' +
            '• <strong>BFP Hotline:</strong> ' + escapeHtml(nearest.facility.phone) + '<br>' +
            '• <strong>Readiness:</strong> Ready for immediate engine & ladder dispatch.',
            [
              {
                label: '🗺️ Route to Station',
                emergency: true,
                action: function () {
                  destinationInput.value = nearest.facility.name;
                  searchDestination(nearest.facility.name, nearest.facility.coordinates, { emergencyType: 'fire', facility: nearest.facility });
                }
              },
              {
                label: '📞 Call ' + nearest.facility.phone,
                href: 'tel:' + nearest.facility.phone.replace(/[^\d+*#;]/g, '')
              },
              {
                label: '🚒 Dispatch Fire Engine',
                action: function () { handleChatIntent('fire'); }
              },
              {
                label: '🚨 Call 911',
                href: 'tel:911',
                emergency: true
              }
            ]
          );
          return;
        }
      }

      // 6. Factors Affecting Travel Time
      if (/factor.*travel|travel.*factor|why.*delay|what affects travel|travel time factor|duration factor|how.*travel time calculated/i.test(q)) {
        appendBotMessage(
          '⏱️ <strong>Factors Affecting Overall Travel Time:</strong><br>' +
          'Our navigation engine computes total travel time using 5 distinct real-world factors:<br><br>' +
          '1. <strong>Base Road Speed:</strong> Free-flow statutory road speed limits (40–60 km/h on arterials, 25–35 km/h in city center).<br>' +
          '2. <strong>Live Traffic Congestion:</strong> Bottlenecks and queueing on named streets add 1.5x–3.2x slowdown multipliers.<br>' +
          '3. <strong>Spatial Hazard Buffers:</strong> Active flood zones, debris, or road work areas require caution deceleration buffers (+2 to +6 min).<br>' +
          '4. <strong>Intersections & Turn Maneuvers:</strong> Each turn maneuver, roundabout, and signal adds ~15–20 seconds deceleration and queue cycle time.<br>' +
          '5. <strong>Road Surface Traction:</strong> Standard dry asphalt friction coefficient (μ ≈ 0.82) under nominal braking conditions.<br><br>' +
          '<strong>Mathematical Equation:</strong><br>' +
          '<code>T(overall) = T(base) + ΔT(traffic) + ΔT(hazards) + ΔT(maneuvers)</code>',
          [
            { label: '🗺️ View Active Route Factors', action: function () { handleChatIntent('route'); } },
            { label: '🛣️ Live Traffic Conditions', action: function () { handleChatIntent('traffic_conditions'); } }
          ]
        );
        return;
      }

      // 7. Factors Affecting Path Selection
      if (/factor.*path|path.*factor|how.*route chosen|why this route|why this path|path selection|route selection/i.test(q)) {
        appendBotMessage(
          '🗺️ <strong>Factors Affecting Overall Path Selection:</strong><br>' +
          'Corridor selection is optimized using 4 algorithmic criteria:<br><br>' +
          '1. <strong>Proximity & Directness Ratio:</strong> Minimizes total distance and compares straight-line radial distance against road distance (>80% directness ratio).<br>' +
          '2. <strong>Corridor Hazard Avoidance:</strong> Dynamically calculates detours around active flood hazards and road closures to prevent blockage.<br>' +
          '3. <strong>Road Hierarchy Prioritization:</strong> Prefers wide multi-lane highways and major boulevards (Diversion Rd, Iloilo-Antique Rd) over narrow residential alleys for emergency vehicle maneuverability.<br>' +
          '4. <strong>Turn Minimization:</strong> Favors linear continuous corridors to preserve vehicle velocity, protect patient stability, and reduce cornering hazards.',
          [
            { label: '🗺️ View Current Route', action: function () { handleChatIntent('route'); } },
            { label: '🛡️ Safe Detours', action: function () { handleChatIntent('traffic_conditions'); } }
          ]
        );
        return;
      }

      // 8. Flood, Road Conditions & Closures
      if (/flood|is.*flooded|diversion.*flood|road condition|road closure|barricade|water.*road|any closure|safe road/i.test(q)) {
        let incidentInfo = '';
        if (Array.isArray(liveIncidents) && liveIncidents.length > 0) {
          incidentInfo = liveIncidents.map(function (inc) {
            return '• <strong>' + escapeHtml(inc.name) + ':</strong> ' + (inc.impassable ? 'Impassable closure (safe detour applied)' : 'Active caution buffer (' + inc.radius + 'm radius)') + ' — ' + escapeHtml(inc.description || '');
          }).join('<br>');
        } else {
          incidentInfo = '• <strong>No Impassable Flood Closures:</strong> All primary corridors are currently navigable.';
        }

        appendBotMessage(
          '🌊 <strong>Live Road & Flood Condition Assessment:</strong><br>' +
          incidentInfo + '<br><br>' +
          '🛡️ <strong>Automated Safety Detour:</strong> The navigation engine automatically avoids impassable hazard zones and directs emergency vehicles along clear corridors.',
          [
            {
              label: '🛡️ Calculate Safe Route',
              action: function () {
                if (destinationInput && destinationInput.value) searchButton.click();
                else handleChatIntent('route');
              }
            },
            { label: '🛟 Flood / Water Rescue', action: function () { handleChatIntent('responder-scenario:flood'); } },
            { label: '📞 Call CDRRMO (033) 333-1111', href: 'tel:0333331111' }
          ]
        );
        return;
      }

      // 9. Traffic Status & Congestion
      if (/traffic|heavy traffic|congestion|traffic status|where.*traffic|is there traffic/i.test(q)) {
        appendBotMessage(
          '🚗 <strong>Live Traffic Conditions on Key Corridors:</strong><br>' +
          '• <strong>General Luna Street:</strong> 3.2x slowdown delay (Heavy peak congestion)<br>' +
          '• <strong>Benigno Aquino Ave (Diversion Rd):</strong> 2.5x slowdown delay (Moderate to heavy traffic)<br>' +
          '• <strong>Iznart Street:</strong> 2.8x slowdown delay (Urban center queueing)<br>' +
          '• <strong>Jalandoni & Ledesma Streets:</strong> 2.1x–2.4x slowdown delay<br><br>' +
          '💡 The route finder evaluates these slowdown multipliers live and computes the net travel time equation automatically.',
          [
            { label: '🛣️ Recalculate Fastest Route', action: function () { handleChatIntent('route'); } },
            { label: '🚑 Nearest Hospital', action: function () { handleChatIntent('ambulance'); } }
          ]
        );
        return;
      }

      // First Aid Quick Guides Directory Trigger (Chat Input & Voice)
      if (/^(?:first aid|first-aid|first aid guide|first aid guides|first aid quick guide|first aid quick guides|first aid tips|firstaid|medical first aid|emergency first aid)$/i.test(q) || (/first aid/i.test(q) && /guide|help|list|menu|options|show|what/i.test(q))) {
        handleChatIntent('first_aid');
        return;
      }

      // First Aid - Drowning Protocol
      if (/drown|drowning|submersion|water inhalation|near drowning|nalunod|nalulunod|water rescue/i.test(q)) {
        appendBotMessage(
          '🌊 <strong>Drowning Emergency First Aid Protocol:</strong><br>' +
          '1. <strong>Safety First (Reach / Throw / Row / Go):</strong> Do not endanger yourself in swift or deep water. Throw a flotation device, rope, or branch. Call 911 / Coast Guard immediately.<br>' +
          '2. <strong>Extract Victim to Dry Ground:</strong> Bring victim out onto firm, flat ground while supporting their head and neck.<br>' +
          '3. <strong>Assess Responsiveness & Breathing:</strong> Tilt head back gently and lift chin. Look, listen, and feel for normal breathing (maximum 10 seconds).<br>' +
          '4. <strong>Deliver 5 Initial Rescue Breaths:</strong> Drowning victims experience severe oxygen deprivation (hypoxia). Pinch their nose, seal your mouth over theirs, and give 5 steady rescue breaths watching for chest rise.<br>' +
          '5. <strong>Begin 30:2 CPR Immediately:</strong> If unresponsive or not breathing normally, place hands in the center of the chest and compress 2 inches deep at 100–120 bpm. Alternate 30 compressions with 2 rescue breaths.<br>' +
          '6. <strong>Do NOT Attempt Heimlich to Drain Water:</strong> Chest compressions clear fluid effectively. Pumping the stomach increases vomiting and aspiration risk. Turn victim briefly on their side only if vomit obstructs the mouth.<br>' +
          '7. <strong>Recovery Position & Keep Warm:</strong> If breathing returns, roll onto their side in recovery position. Remove wet clothes, cover with blankets to combat hypothermia, and monitor closely for secondary drowning until emergency responders arrive.',
          [
            { label: '📞 Call 911 Immediately', href: 'tel:911', emergency: true },
            { label: '🚑 Dispatch Ambulance', emergency: true, action: function () { handleChatIntent('ambulance'); } },
            { label: '🫀 CPR Instructions', action: function () { answerUserEmergencyQuestion('cpr'); } },
            { label: '🩹 All First Aid Guides', action: function () { handleChatIntent('first_aid'); } }
          ]
        );
        return;
      }

      // 10. First Aid - CPR
      if (/cpr|cardiac arrest|heart attack|not breathing|unresponsive|chest compression/i.test(q)) {
        appendBotMessage(
          '🫀 <strong>Immediate CPR Life-Saving Steps:</strong><br>' +
          '1. <strong>Call 911 Immediately:</strong> Put on speakerphone while starting compressions.<br>' +
          '2. <strong>Hand Placement:</strong> Place the heel of one hand in the center of the chest, other hand interlaced on top.<br>' +
          '3. <strong>Compress Hard & Fast:</strong> Push down 2 inches deep at 100–120 beats per minute (to the rhythm of "Stayin\' Alive").<br>' +
          '4. <strong>Allow Full Chest Recoil:</strong> Don\'t lean on the chest between compressions.<br>' +
          '5. <strong>Continue Non-Stop:</strong> Do not pause compressions until emergency medics arrive or an AED is analyzing.',
          [
            { label: '📞 Call 911 Now', href: 'tel:911', emergency: true },
            { label: '🚑 Dispatch Ambulance', action: function () { handleChatIntent('ambulance'); } },
            { label: '🏥 Nearest Emergency Room', action: function () { handleChatIntent('ambulance'); } },
            { label: '🩹 All First Aid Guides', action: function () { handleChatIntent('first_aid'); } }
          ]
        );
        return;
      }

      // 11. First Aid - Burns
      if (/burn|scalding|scald|burned skin|fire burn/i.test(q)) {
        appendBotMessage(
          '🔥 <strong>Emergency Burn Care Steps:</strong><br>' +
          '1. <strong>Cool with Running Water:</strong> Hold burn under cool running tap water for 10–20 minutes immediately.<br>' +
          '2. <strong>Do NOT Use Ice or Butter:</strong> Ice causes tissue damage; butter and oil trap heat.<br>' +
          '3. <strong>Remove Tight Items:</strong> Gently remove rings or tight clothing before swelling starts.<br>' +
          '4. <strong>Cover Loosely:</strong> Use a clean, sterile cloth or clear plastic cling film.<br>' +
          '5. <strong>Seek Emergency Care:</strong> If burn is larger than the person\'s palm, involves the face/hands, or has blisters.',
          [
            { label: '🚑 Dispatch Ambulance', emergency: true, action: function () { handleChatIntent('ambulance'); } },
            { label: '🏥 Nearest Hospital / Burn Care', action: function () { handleChatIntent('ambulance'); } },
            { label: '📞 Call Red Cross', href: 'tel:0333375976' },
            { label: '🩹 All First Aid Guides', action: function () { handleChatIntent('first_aid'); } }
          ]
        );
        return;
      }

      // 12. First Aid - Choking / Heimlich
      if (/choking|choke|cannot breathe|blocked airway|heimlich/i.test(q)) {
        appendBotMessage(
          '🗣️ <strong>Emergency Choking Relief (Heimlich Maneuver):</strong><br>' +
          '1. <strong>Encourage Coughing:</strong> If they can cough or make sound, let them try to clear the object.<br>' +
          '2. <strong>5 Back Blows:</strong> Lean the person forward and give 5 firm blows between shoulder blades with the heel of your hand.<br>' +
          '3. <strong>5 Abdominal Thrusts:</strong> Stand behind them, wrap arms around waist, make a fist above their navel, and pull sharply inward and upward.<br>' +
          '4. <strong>Alternate:</strong> Repeat 5 back blows and 5 thrusts until airway clears or person becomes unconscious.<br>' +
          '5. <strong>If Unresponsive:</strong> Lower to the floor and begin CPR compressions immediately.',
          [
            { label: '📞 Call 911 Immediately', href: 'tel:911', emergency: true },
            { label: '🚑 Dispatch Ambulance', action: function () { handleChatIntent('ambulance'); } },
            { label: '🩹 All First Aid Guides', action: function () { handleChatIntent('first_aid'); } }
          ]
        );
        return;
      }

      // 13. First Aid - Bleeding & Wounds
      if (/bleed|hemorrhage|wound|cut|stab|blood/i.test(q)) {
        appendBotMessage(
          '🩸 <strong>Emergency Bleeding Control:</strong><br>' +
          '1. <strong>Direct Pressure:</strong> Press firmly on the wound with a clean cloth or gauze for at least 5–10 minutes without lifting.<br>' +
          '2. <strong>Elevate:</strong> If possible, raise the injured limb above the level of the heart.<br>' +
          '3. <strong>Do NOT Remove Objects:</strong> If an object is embedded, leave it in place and pad around it.<br>' +
          '4. <strong>Apply Pressure Bandage:</strong> Wrap firmly over the dressing.<br>' +
          '5. <strong>Keep Calm & Warm:</strong> Treat for shock and keep the patient lying down.',
          [
            { label: '🚑 Dispatch Ambulance', emergency: true, action: function () { handleChatIntent('ambulance'); } },
            { label: '🏥 Nearest Hospital', action: function () { handleChatIntent('ambulance'); } },
            { label: '📞 Call Red Cross (033) 337-5976', href: 'tel:0333375976' },
            { label: '🩹 All First Aid Guides', action: function () { handleChatIntent('first_aid'); } }
          ]
        );
        return;
      }

      // First Aid - Fractures, Broken Bones & Sprains
      if (/fracture|broken bone|bone break|sprain|strain|dislocation|broken arm|broken leg|twisted ankle|bali.*buto|pilay/i.test(q)) {
        appendBotMessage(
          '🦴 <strong>Fracture & Sprain Emergency Protocol:</strong><br>' +
          '1. <strong>Immobilize Immediately:</strong> Keep the person and injured area still. Do NOT try to straighten, realign, or force a broken bone or dislocated joint back in place.<br>' +
          '2. <strong>Support & Splint:</strong> Support joints above and below the fracture using padded boards, folded cardboard, or rolled magazines tied loosely with cloth. Do not tie tightly enough to restrict blood flow.<br>' +
          '3. <strong>R.I.C.E. for Sprains & Strains:</strong> Rest the limb, apply Ice wrapped in cloth (15–20 min intervals), Compress lightly with elastic bandage, and Elevate above heart level if tolerated.<br>' +
          '4. <strong>Open / Compound Fracture:</strong> If bone is exposed through skin, do NOT push it back. Cover gently with sterile gauze/clean cloth and apply pressure around wound edges to control bleeding.<br>' +
          '5. <strong>Check Blood Flow:</strong> Confirm fingers/toes beyond the injury remain warm and pink with normal sensation.<br>' +
          '6. <strong>Seek Emergency Orthopedic Care:</strong> Dispatch ambulance or transport safely to nearest emergency hospital.',
          [
            { label: '🚑 Dispatch Ambulance', emergency: true, action: function () { handleChatIntent('ambulance'); } },
            { label: '🏥 Nearest Hospital / Trauma Center', action: function () { handleChatIntent('ambulance'); } },
            { label: '🩹 All First Aid Guides', action: function () { handleChatIntent('first_aid'); } }
          ]
        );
        return;
      }

      // First Aid - Severe Allergic Reaction / Anaphylaxis
      if (/allergy|allergic|anaphylaxis|anaphylactic|epipen|hives|swollen throat|swollen face|severe allergic/i.test(q)) {
        appendBotMessage(
          '⚠️ <strong>Anaphylaxis & Severe Allergic Reaction Protocol:</strong><br>' +
          '1. <strong>Call 911 / Emergency Ambulance Immediately:</strong> Anaphylaxis can rapidly progress to complete airway closure and shock.<br>' +
          '2. <strong>Administer Epinephrine (EpiPen) Without Delay:</strong> If prescribed an auto-injector, grasp firmly, remove safety cap, push orange tip firmly into outer mid-thigh until click sounds, and hold for 3 seconds.<br>' +
          '3. <strong>Position the Victim:</strong> Lay them flat on their back and elevate legs 12 inches to maintain blood pressure. If having severe breathing difficulty, allow them to sit upright.<br>' +
          '4. <strong>Do NOT Give Oral Fluids or Food:</strong> Swelling can cause choking or aspiration.<br>' +
          '5. <strong>Loosen Tight Garments:</strong> Unbutton collar, loosen belt or necktie to relieve breathing restriction.<br>' +
          '6. <strong>Monitor Breathing & Second Dose:</strong> If symptoms worsen or do not improve after 5–15 minutes and medics have not arrived, deliver a second dose if available. Begin CPR immediately if breathing stops.',
          [
            { label: '📞 Call 911 Now', href: 'tel:911', emergency: true },
            { label: '🚑 Dispatch Ambulance', emergency: true, action: function () { handleChatIntent('ambulance'); } },
            { label: '🫀 CPR Instructions', action: function () { answerUserEmergencyQuestion('cpr'); } },
            { label: '🩹 All First Aid Guides', action: function () { handleChatIntent('first_aid'); } }
          ]
        );
        return;
      }

      // 14. First Aid - Dog Bite / Snake Bite / Rabies
      if (/dog bite|animal bite|snake bite|rabies|bitten/i.test(q)) {
        appendBotMessage(
          '🐕 <strong>Animal / Snake Bite Emergency Protocol:</strong><br>' +
          '1. <strong>Wash Immediately:</strong> Wash wound with soap and running water vigorously for at least 15 minutes.<br>' +
          '2. <strong>Do NOT Suck or Cut Venom:</strong> For snakebites, keep limb still and below heart level.<br>' +
          '3. <strong>Disinfect:</strong> Apply povidone-iodine or alcohol if available.<br>' +
          '4. <strong>Seek Immediate Care:</strong> Go immediately to Western Visayas Medical Center (WVMC) Animal Bite Clinic for anti-rabies or antivenom treatment.',
          [
            {
              label: '🗺️ Route to WVMC Animal Bite Clinic',
              emergency: true,
              action: function () {
                const wvmc = KNOWN_EMERGENCY_FACILITIES.find(function (f) { return f.name.includes('WVMC'); });
                if (wvmc) {
                  destinationInput.value = wvmc.name;
                  searchDestination(wvmc.name, wvmc.coordinates, { emergencyType: 'ambulance', facility: wvmc });
                }
              }
            },
            { label: '📞 Call WVMC (033) 321-2841', href: 'tel:0333212841' },
            { label: '🩹 All First Aid Guides', action: function () { handleChatIntent('first_aid'); } }
          ]
        );
        return;
      }

      // 15. Earthquake Safety Protocol
      if (/earthquake|lindol|ground shaking|tremor/i.test(q)) {
        appendBotMessage(
          '🏚️ <strong>Earthquake Safety Protocol (Drop, Cover, and Hold On):</strong><br>' +
          '1. <strong>DROP:</strong> Drop onto your hands and knees immediately to prevent being knocked over.<br>' +
          '2. <strong>COVER:</strong> Cover your head and neck under a sturdy table, desk, or interior furniture.<br>' +
          '3. <strong>HOLD ON:</strong> Hold on to your shelter until the ground shaking stops completely.<br>' +
          '4. <strong>Stay Away:</strong> Keep away from glass windows, hanging objects, tall cabinets, and exterior walls.<br>' +
          '5. <strong>If Outdoors:</strong> Move away from buildings, power lines, billboards, and trees into an open area.<br>' +
          '6. <strong>If in a Vehicle:</strong> Pull over safely away from overpasses, bridges, and power lines; remain inside with seatbelts fastened.<br>' +
          '7. <strong>Aftershocks:</strong> Be prepared for aftershocks; check for injuries and gas leaks before exiting.',
          [
            { label: '☎️ Emergency Hotlines', emergency: true, action: function () { handleChatIntent('hotlines'); } },
            { label: '🛟 Disaster Rescue', action: function () { handleChatIntent('responder'); } },
            { label: '🚑 Medical / Ambulance', action: function () { handleChatIntent('ambulance'); } }
          ]
        );
        return;
      }

      // 16. Typhoon & Storm Safety
      if (/typhoon|bagyo|storm surge|cyclone|strong winds|gale/i.test(q)) {
        appendBotMessage(
          '🌀 <strong>Typhoon & Severe Storm Protocol:</strong><br>' +
          '1. <strong>Stay Indoors:</strong> Keep away from windows and glass doors; remain on the ground floor or a designated sturdy room.<br>' +
          '2. <strong>Monitor Weather:</strong> Keep battery-powered radios on for local CDRRMO and PAGASA storm bulletins.<br>' +
          '3. <strong>Shut Off Utilities:</strong> Turn off main power circuit breakers and gas valves if flooding begins.<br>' +
          '4. <strong>Avoid Flood Waters:</strong> Never walk or drive through flowing water—swift water as shallow as 6 inches can knock you down.<br>' +
          '5. <strong>Keep Emergency Go-Bag:</strong> Keep drinking water, canned foods, flashlights, power banks, and first aid kits accessible.<br>' +
          '6. <strong>Evacuation:</strong> If advised to evacuate by barangay or city officials, move early to designated evacuation centers.',
          [
            { label: '🛟 Flood / Water Rescue', emergency: true, action: function () { handleChatIntent('responder-scenario:flood'); } },
            { label: '📞 Call CDRRMO (033) 333-1111', href: 'tel:0333331111' },
            { label: '☎️ All 911 Hotlines', action: function () { handleChatIntent('hotlines'); } }
          ]
        );
        return;
      }

      // 17. Landslide Protocol
      if (/landslide|mudslide|rockfall|soil collapse/i.test(q)) {
        appendBotMessage(
          '⛰️ <strong>Landslide Emergency Protocol:</strong><br>' +
          '1. <strong>Evacuate Immediately:</strong> If you observe ground cracks, leaning poles/trees, or sudden muddy water flow, evacuate uphill and away from the slope.<br>' +
          '2. <strong>Avoid River Channels:</strong> Debris flows follow river valleys and low drainage channels.<br>' +
          '3. <strong>If Trapped:</strong> Curl into a tight ball and protect your head with your arms.<br>' +
          '4. <strong>Alert Authorities:</strong> Report blocked roadways, buried structures, or trapped individuals to CDRRMO.',
          [
            { label: '🛟 Disaster Rescue', emergency: true, action: function () { handleChatIntent('responder'); } },
            { label: '📞 Call CDRRMO (033) 333-1111', href: 'tel:0333331111' },
            { label: '🚨 Call 911', href: 'tel:911', emergency: true }
          ]
        );
        return;
      }

      // 18. Stroke (F.A.S.T.)
      if (/stroke|brain attack|facial droop|slurred speech|numbness in arm/i.test(q)) {
        appendBotMessage(
          '🧠 <strong>Stroke Emergency — Remember F.A.S.T.:</strong><br>' +
          '• <strong>F (Face Drooping):</strong> Does one side of the face droop? Ask the person to smile.<br>' +
          '• <strong>A (Arm Weakness):</strong> Is one arm weak or numb? Ask the person to raise both arms.<br>' +
          '• <strong>S (Speech Difficulty):</strong> Is speech slurred or strange? Ask them to repeat a simple phrase.<br>' +
          '• <strong>T (Time to Call 911):</strong> Every second counts. Do NOT wait. Call 911 or rush to a tertiary hospital with stroke capability immediately.<br><br>' +
          '<em>Top Stroke Centers in Iloilo:</em> Western Visayas Medical Center (WVMC), Iloilo Doctors\' Hospital, St. Paul\'s Hospital.',
          [
            { label: '📞 Call 911 Immediately', href: 'tel:911', emergency: true },
            { label: '🚑 Dispatch Ambulance', action: function () { handleChatIntent('ambulance'); } },
            {
              label: '🗺️ Route to WVMC',
              action: function () {
                const wvmc = KNOWN_EMERGENCY_FACILITIES.find(function (f) { return f.name.includes('WVMC'); });
                if (wvmc) {
                  activateEmergencyRouteFromChat(wvmc.name, wvmc.coordinates, wvmc, 'ambulance');
                }
              }
            },
            { label: '🩹 All First Aid Guides', action: function () { handleChatIntent('first_aid'); } }
          ]
        );
        return;
      }

      // 19. Seizure / Convulsion
      if (/seizure|convulsion|epilepsy|fitting|convulsing/i.test(q)) {
        appendBotMessage(
          '⚠️ <strong>Seizure First Aid Protocol:</strong><br>' +
          '1. <strong>Cushion the Head:</strong> Place a soft jacket or cushion under the person\'s head.<br>' +
          '2. <strong>Clear the Area:</strong> Remove sharp, hard, or hot objects away from the person.<br>' +
          '3. <strong>Do NOT Restrain:</strong> Do not hold the person down or try to stop their movements.<br>' +
          '4. <strong>Do NOT Put Anything in Mouth:</strong> They will NOT swallow their tongue. Objects can break teeth or block airway.<br>' +
          '5. <strong>Turn on Side:</strong> Once jerking stops, gently roll the person onto their side (recovery position) to keep airway open.<br>' +
          '6. <strong>Call 911 If:</strong> Seizure lasts >5 minutes, another seizure begins, or person is pregnant or injured.',
          [
            { label: '📞 Call 911 Now', href: 'tel:911', emergency: true },
            { label: '🚑 Dispatch Ambulance', action: function () { handleChatIntent('ambulance'); } },
            { label: '🏥 Nearest Hospital', action: function () { handleChatIntent('ambulance'); } },
            { label: '🩹 All First Aid Guides', action: function () { handleChatIntent('first_aid'); } }
          ]
        );
        return;
      }

      // 20. Asthma / Breathing Distress
      if (/asthma|wheezing|inhaler|short of breath|difficulty breathing|hard to breathe/i.test(q)) {
        appendBotMessage(
          '🫁 <strong>Asthma & Acute Breathing Emergency:</strong><br>' +
          '1. <strong>Sit Upright:</strong> Keep calm and sit upright. Do NOT let the person lie down.<br>' +
          '2. <strong>Use Inhaler:</strong> Give 2 to 4 puffs of quick-relief blue inhaler (Salbutamol) via spacer if available. Repeat 1 puff every minute up to 10 puffs.<br>' +
          '3. <strong>Loosen Clothing:</strong> Open collar and loosen tight clothing around neck and chest.<br>' +
          '4. <strong>Emergency Signs:</strong> If unable to speak full sentences, chest is sucking in, lips/fingernails turning blue, or symptoms don\'t improve in 5 minutes, call 911 immediately.',
          [
            { label: '📞 Call 911 Now', href: 'tel:911', emergency: true },
            { label: '🚑 Dispatch Ambulance', action: function () { handleChatIntent('ambulance'); } },
            { label: '🏥 Nearest Emergency Room', action: function () { handleChatIntent('ambulance'); } },
            { label: '🩹 All First Aid Guides', action: function () { handleChatIntent('first_aid'); } }
          ]
        );
        return;
      }

      // 21. Heat Stroke
      if (/heat stroke|heatstroke|heat exhaustion|overheating|sunstroke/i.test(q)) {
        appendBotMessage(
          '☀️ <strong>Heat Stroke Protocol (Life-Threatening Emergency):</strong><br>' +
          '1. <strong>Move to Cool Area:</strong> Immediately relocate the person into shade or air conditioning.<br>' +
          '2. <strong>Rapid Body Cooling:</strong> Immerse or sponge body with cold water; place ice packs or cold damp towels on neck, armpits, and groin.<br>' +
          '3. <strong>Fan Vigorously:</strong> Promote heat evaporation with electric fan or waving folded paper.<br>' +
          '4. <strong>Hydration:</strong> If fully conscious and not nauseous, give cool sips of water. Do NOT force liquids if disoriented.<br>' +
          '5. <strong>Medical Emergency:</strong> Heat stroke causes organ damage. Dispatch an ambulance immediately.',
          [
            { label: '🚑 Dispatch Ambulance', emergency: true, action: function () { handleChatIntent('ambulance'); } },
            { label: '🏥 Nearest Hospital', action: function () { handleChatIntent('ambulance'); } },
            { label: '📞 Call Red Cross', href: 'tel:0333375976' },
            { label: '🩹 All First Aid Guides', action: function () { handleChatIntent('first_aid'); } }
          ]
        );
        return;
      }

      // 22. Electric Shock
      if (/electric shock|electrocution|electrocuted|high voltage/i.test(q)) {
        appendBotMessage(
          '⚡ <strong>Electric Shock Emergency Protocol:</strong><br>' +
          '1. <strong>Do NOT Touch the Victim Directly:</strong> If they are still touching the live current, you will be electrocuted too!<br>' +
          '2. <strong>Cut the Power:</strong> Turn off main electrical breaker or switch off the appliance immediately.<br>' +
          '3. <strong>Separate from Current:</strong> If power cannot be shut off, use a dry non-conductive wooden stick or broom handle to push the wire away.<br>' +
          '4. <strong>Check Breathing:</strong> If not breathing or no pulse, begin CPR immediately.<br>' +
          '5. <strong>Treat Burns & Shock:</strong> Keep warm and call 911.',
          [
            { label: '📞 Call 911 Immediately', href: 'tel:911', emergency: true },
            { label: '🚑 Dispatch Ambulance', action: function () { handleChatIntent('ambulance'); } },
            { label: '🫀 CPR Instructions', action: function () { answerUserEmergencyQuestion('cpr'); } },
            { label: '🩹 All First Aid Guides', action: function () { handleChatIntent('first_aid'); } }
          ]
        );
        return;
      }

      // 23. Poisoning / Chemical Ingestion
      if (/poison|toxic|swallowed chemical|ingested bleach|overdose/i.test(q)) {
        appendBotMessage(
          '🧪 <strong>Poisoning & Ingestion Protocol:</strong><br>' +
          '1. <strong>Do NOT Induce Vomiting:</strong> Caustic chemicals (bleach, acid) will re-burn the esophagus on the way back up.<br>' +
          '2. <strong>Identify Substance:</strong> Save container, bottle, or packaging to show doctors.<br>' +
          '3. <strong>Rinse Eyes/Skin:</strong> If chemical splashed, flush with running water for 15 minutes.<br>' +
          '4. <strong>Rush to Hospital:</strong> Proceed immediately to WVMC or nearest tertiary hospital emergency department.',
          [
            {
              label: '🗺️ Route to WVMC Emergency',
              emergency: true,
              action: function () {
                const wvmc = KNOWN_EMERGENCY_FACILITIES.find(function (f) { return f.name.includes('WVMC'); });
                if (wvmc) {
                  activateEmergencyRouteFromChat(wvmc.name, wvmc.coordinates, wvmc, 'ambulance');
                }
              }
            },
            { label: '📞 Call 911', href: 'tel:911', emergency: true },
            { label: '🚑 Dispatch Ambulance', action: function () { handleChatIntent('ambulance'); } },
            { label: '🩹 All First Aid Guides', action: function () { handleChatIntent('first_aid'); } }
          ]
        );
        return;
      }

      // 24. Evacuation Centers
      if (/evacuation center|where to evacuate|shelter|evacuate/i.test(q)) {
        appendBotMessage(
          '🏛️ <strong>Designated Disaster Evacuation Centers in the Region:</strong><br>' +
          '• <strong>Mandurriao District:</strong> Mandurriao Covered Gym / Mandurriao Elementary School<br>' +
          '• <strong>Molo District:</strong> Molo Plaza Activity Gym<br>' +
          '• <strong>Jaro District:</strong> Jaro Plaza Covered Gym / Central Philippine University Gym<br>' +
          '• <strong>City Center / La Paz:</strong> Iloilo Sports Complex / La Paz Plaza Gym<br>' +
          '• <strong>Oton Municipality:</strong> Oton Municipal Gymnasium / Oton National High School<br><br>' +
          '<em>Tip: Contact Iloilo City CDRRMO at (033) 333-1111 for real-time evacuation bed availability and transport assistance.</em>',
          [
            {
              label: '🗺️ Route to Mandurriao Gym',
              action: function () {
                destinationInput.value = 'Mandurriao Covered Gym';
                searchDestination('Mandurriao Covered Gym', [122.5350, 10.7180]);
              }
            },
            { label: '🛟 Flood / Water Rescue', action: function () { handleChatIntent('responder-scenario:flood'); } },
            { label: '📞 Call CDRRMO', href: 'tel:0333331111' }
          ]
        );
        return;
      }

      // 25. Pharmacies & Medicines
      if (/pharmacy|drugstore|medicine|buy medicine|mercury drug|watsons/i.test(q)) {
        appendBotMessage(
          '💊 <strong>24/7 Hospital Pharmacies & Emergency Dispensaries:</strong><br>' +
          '• <strong>Western Visayas Medical Center (WVMC) 24/7 Pharmacy:</strong> Q. Abeto St, Mandurriao<br>' +
          '• <strong>Iloilo Doctors\' Hospital 24/7 Pharmacy:</strong> West Timawa, Molo<br>' +
          '• <strong>St. Paul\'s Hospital Emergency Pharmacy:</strong> General Luna St, City Proper<br>' +
          '• <strong>QualiMed Hospital Pharmacy:</strong> Atria Park District, Mandurriao<br>' +
          '• <strong>Mercury Drug (24-Hour Branches):</strong> Gen. Luna St & Valeria St branches open 24/7.',
          [
            {
              label: '🗺️ Route to WVMC Pharmacy',
              action: function () {
                const wvmc = KNOWN_EMERGENCY_FACILITIES.find(function (f) { return f.name.includes('WVMC'); });
                if (wvmc) {
                  activateEmergencyRouteFromChat(wvmc.name, wvmc.coordinates, wvmc, 'ambulance');
                } else {
                  activateEmergencyRouteFromChat('Western Visayas Medical Center', [122.5342, 10.7188], null, 'ambulance');
                }
              }
            },
            {
              label: '🗺️ Route to Doctors Hospital',
              action: function () {
                const docHosp = KNOWN_EMERGENCY_FACILITIES.find(function (f) { return f.name.includes('Doctor'); });
                if (docHosp) {
                  activateEmergencyRouteFromChat(docHosp.name, docHosp.coordinates, docHosp, 'ambulance');
                } else {
                  activateEmergencyRouteFromChat("Iloilo Doctors' Hospital", [122.5489, 10.7001], null, 'ambulance');
                }
              }
            },
            { label: '🚑 Request Ambulance', action: function () { handleChatIntent('ambulance'); } }
          ]
        );
        return;
      }

      // 26. Emergency Go-Bag Checklist
      if (/go bag|go-bag|survival kit|emergency kit|emergency bag|what to pack/i.test(q)) {
        appendBotMessage(
          '🎒 <strong>Emergency Go-Bag Checklist (72-Hour Survival Kit):</strong><br>' +
          '• <strong>Water:</strong> 1 gallon (4 liters) per person per day for 3 days.<br>' +
          '• <strong>Food:</strong> Ready-to-eat canned goods, energy biscuits, and can opener.<br>' +
          '• <strong>First Aid Kit:</strong> Antiseptic, bandages, medical tape, sterile gauze, personal prescription meds.<br>' +
          '• <strong>Tools & Lighting:</strong> Sturdy LED flashlight, extra batteries, emergency whistle, multi-tool knife.<br>' +
          '• <strong>Power & Radio:</strong> Portable power bank, charging cables, battery-operated AM/FM radio.<br>' +
          '• <strong>Important Papers:</strong> Waterproof pouch containing photocopies of IDs, birth certs, land titles, and emergency cash.<br>' +
          '• <strong>Hygiene:</strong> Hand sanitizer, wet wipes, soap, toothbrushes, N95 dust/smoke masks.',
          [
            { label: '🩹 First Aid Guide', action: function () { handleChatIntent('first_aid'); } },
            { label: '☎️ Emergency Hotlines', action: function () { handleChatIntent('hotlines'); } },
            { label: '🛟 Flood / Water Rescue', action: function () { handleChatIntent('responder-scenario:flood'); } }
          ]
        );
        return;
      }

      // 27. Offline Functionality
      if (/offline|without internet|no internet|work offline|offline mode|no signal/i.test(q)) {
        appendBotMessage(
          '📶 <strong>Offline Capabilities in This App:</strong><br>' +
          '• <strong>App Shell Pre-cached:</strong> The user interface, leaflet maps, icons, and emergency styles operate fully offline.<br>' +
          '• <strong>Offline Emergency Database:</strong> All hospitals, police precincts, and fire stations remain searchable without internet.<br>' +
          '• <strong>Regional Map Tiles:</strong> Zoom levels 12 & 13 covering Oton, Mandurriao, Molo, and Iloilo City are cached locally.<br>' +
          '• <strong>Direct Geodesic Compass Routing:</strong> If the online routing engine is unreachable, the app automatically generates direct navigation vectors with calculated travel times.<br>' +
          '• <strong>Offline Caching:</strong> All previously viewed routes and location searches are retained in local offline storage.',
          [
            { label: '🗺️ Search Route', action: function () { handleChatIntent('route'); } },
            { label: '🏥 Nearest Hospital', action: function () { handleChatIntent('ambulance'); } },
            { label: '☎️ 911 Hotlines', action: function () { handleChatIntent('hotlines'); } }
          ]
        );
        return;
      }

      // 28. Algorithm & Technical Details
      if (/algorithm|bellman|a star|a\*|how does routing work|routing engine/i.test(q)) {
        appendBotMessage(
          '⚙️ <strong>Algorithm & Routing Technical Details:</strong><br>' +
          '• <strong>Algorithm:</strong> Bellman-Ford and A* shortest path algorithms with dynamic multi-factor edge weighting.<br>' +
          '• <strong>Live Traffic Weighting:</strong> Road segments evaluate vehicular queueing, applying 1.5x–3.2x multiplier cost penalties.<br>' +
          '• <strong>Spatial Hazard Buffers:</strong> Geometric collision detection identifies active flood zones and road work buffers.<br>' +
          '• <strong>Automated Detour Synthesis:</strong> If an edge is impassable (road closure), edge cost is set to infinity to divert traffic to safe alternative corridors.<br>' +
          '• <strong>Intersection Cost Model:</strong> Every turn maneuver accounts for deceleration and signal cycle wait times (~15 sec per turn).',
          [
            { label: '⏱️ Travel Factors', action: function () { handleChatIntent('travel_factors'); } },
            { label: '🗺️ Show Route on Map', action: function () { handleChatIntent('route'); } }
          ]
        );
        return;
      }

      // 29. How to Report an Incident
      if (/how to report|add incident|report hazard|report flood|add hazard|report closure/i.test(q)) {
        appendBotMessage(
          '⚠️ <strong>How to Report a Road Incident or Hazard:</strong><br>' +
          '1. Look at the bottom-right map toolbar and click the <strong>⚠️ Report Incident</strong> button.<br>' +
          '2. Click the exact location on the map where the flood, blockage, or road closure is located.<br>' +
          '3. Select the incident category (e.g. Flash Flood, Road Closure, Accident, or Hazard).<br>' +
          '4. Once placed, the incident appears as a spatial warning bubble, and the route engine will immediately recalculate all emergency routes around it!',
          [
            {
              label: '⚠️ Report Incident on Map',
              action: function () {
                toggleAddIncidentMode(true);
                closeAssistanceChat();
              }
            },
            { label: '🌊 Current Flood Zones', action: function () { answerUserEmergencyQuestion('flood'); } }
          ]
        );
        return;
      }

      // 30. Local Authorities (CDRRMO, BFP, PNP, Red Cross)
      if (/what is cdrrmo|what is bfp|what is pnp|who is cdrrmo|authorities/i.test(q)) {
        appendBotMessage(
          '🛡️ <strong>Regional Emergency Organizations:</strong><br>' +
          '• <strong>CDRRMO (City Disaster Risk Reduction & Management Office):</strong> Leads disaster response, water rescue, storm evacuation, and citywide disaster mitigation. Hotline: (033) 333-1111.<br>' +
          '• <strong>BFP (Bureau of Fire Protection):</strong> Fire suppression, structural search and rescue, hazmat incident handling. Hotline: 160 / (033) 337-4444.<br>' +
          '• <strong>PNP (Philippine National Police - ICPO):</strong> Crime prevention, vehicular accident investigation, and law enforcement. Hotline: 117 / (033) 337-0400.<br>' +
          '• <strong>Philippine Red Cross:</strong> Emergency ambulance dispatch, first aid training, blood bank, and relief distribution. Hotline: 143 / (033) 337-5976.',
          [
            { label: '☎️ Call 911', href: 'tel:911', emergency: true },
            { label: '📞 Call CDRRMO', href: 'tel:0333331111' },
            { label: '📞 Call Red Cross', href: 'tel:0333375976' },
            { label: '📞 Call Police', href: 'tel:0333370400' }
          ]
        );
        return;
      }

      // 31. Accident / Vehicle Crash
      if (/accident|crash|collision|hit and run|car accident|motorcycle accident|wreck/i.test(q)) {
        appendBotMessage(
          '🚗 <strong>Motor Vehicle Accident Protocol:</strong><br>' +
          '1. <strong>Ensure Scene Safety:</strong> Turn on hazard lights, stay off the roadway if vehicles are passing.<br>' +
          '2. <strong>Do NOT Move Seriously Injured:</strong> Protect neck and spine unless immediate fire or explosion hazard.<br>' +
          '3. <strong>Check Airway & Bleeding:</strong> Apply direct pressure to severe bleeding.<br>' +
          '4. <strong>Dispatch Emergency Services:</strong> Request ambulance and police units immediately.',
          [
            { label: '🚑 Dispatch Ambulance', emergency: true, action: function () { handleChatIntent('ambulance'); } },
            { label: '🚓 Request Police', emergency: true, action: function () { handleChatIntent('police'); } },
            { label: '📞 Call 911', href: 'tel:911', emergency: true }
          ]
        );
        return;
      }

      // 32. Fire Reporting
      if (/fire|smoke|burning|flame|gas leak|explosion/i.test(q)) {
        appendBotMessage(
          '🔥 <strong>Fire Emergency Protocol:</strong><br>' +
          '1. <strong>Evacuate Immediately:</strong> Get out and stay out; do NOT use elevators.<br>' +
          '2. <strong>Stay Low:</strong> Smoke and toxic gases rise; crawl beneath smoke if necessary.<br>' +
          '3. <strong>Feel Closed Doors:</strong> Touch door with back of hand before opening; if hot, do not open.<br>' +
          '4. <strong>Dispatch Fire Engine:</strong> Report exact location to BFP.',
          [
            { label: '🚒 Dispatch Fire Engine', emergency: true, action: function () { handleChatIntent('fire'); } },
            { label: '📞 Call BFP (033) 337-4444', href: 'tel:0333374444' },
            { label: '🚨 Call 911', href: 'tel:911', emergency: true }
          ]
        );
        return;
      }

      // 33. Hotlines / Phone numbers
      if (/hotline|phone number|call number|emergency number|contact|telephone|who to call/i.test(q)) {
        handleChatIntent('hotlines');
        return;
      }

      // 34. Greetings / Help / Emergency Assistance & 24/7 Dispatch Trigger
      if (/^(hi|hello|hey|good morning|good afternoon|good evening|kamusta|musta|help|need help|yo)$/i.test(q) || q === 'help' || /^(?:emergency assistance|24\/7 dispatch|dispatch|main menu|menu|back to dispatch|home|back to home)$/i.test(q)) {
        displayEmergencyAssistanceDispatchMenu();
        return;
      }

      // 35. Features / About / How to use
      if (/what can you do|how to use|features|commands|about/i.test(q)) {
        appendBotMessage(
          'ℹ️ <strong>System Capabilities:</strong><br>' +
          '• <strong>Factor-Aware Routing:</strong> Bellman-Ford/A* algorithm evaluating traffic, spatial hazards, turns, and friction.<br>' +
          '• <strong>Emergency Directory:</strong> 24/7 verified database of hospitals, police stations, fire bases, and rescue units.<br>' +
          '• <strong>Automated Detour Engine:</strong> Bypasses road closures, flood zones, and heavy congestion.<br>' +
          '• <strong>First Aid Assistant:</strong> Instant step-by-step guidance for drowning rescue, CPR, bleeding, burns, choking, fractures, anaphylaxis, heat stroke, and poisoning.<br>' +
          '• <strong>Offline Navigation:</strong> Cached tile rendering and direct compass navigation when offline.',
          [
            { label: '🚑 Medical / Ambulance', action: function () { handleChatIntent('ambulance'); } },
            { label: '🚓 Police', action: function () { handleChatIntent('police'); } },
            { label: '🚒 Fire', action: function () { handleChatIntent('fire'); } },
            { label: '☎️ Hotlines', action: function () { handleChatIntent('hotlines'); } }
          ]
        );
        return;
      }

      // 36. Smart Direct Answer to Any Open User Question
      let directAnswer = '';
      if (q.includes('why') || q.includes('how')) {
        directAnswer = 'Our emergency assistance and navigation system is engineered to provide instant solutions based on real-time spatial conditions in the Iloilo region. We calculate factor-aware routes, monitor active flood and traffic hazard buffers, and connect you with 24/7 emergency responders.';
      } else if (q.includes('can i') || q.includes('can you') || q.includes('is it')) {
        directAnswer = 'Yes! The route finder and emergency assistance system provides live factor-aware routing, offline navigation, emergency facility directories, and instant first aid guidance across the entire Panay / Iloilo area.';
      } else if (q.includes('who') || q.includes('what is') || q.includes('what are')) {
        directAnswer = 'This platform is an emergency-ready, factor-aware route finding system integrating live traffic models, flood hazard avoidance, automated detour synthesis, and 24/7 emergency dispatch directory for Iloilo City and surrounding municipalities.';
      } else {
        directAnswer = 'I am actively monitoring emergency routes, hospital readiness, traffic conditions, and local disaster advisories. Here are the immediate emergency actions available for your position:';
      }

      // 1. Direct answer the user's inquiry first
      appendBotMessage(
        '💬 <strong>Direct Answer:</strong><br>' +
        'Regarding your inquiry: <em>"' + escapeHtml(userText) + '"</em><br><br>' +
        directAnswer
      );

      // 2. Appear "How can we assist your emergency or navigation needs right now?" and its options after the question has been answered
      setTimeout(function () {
        appendBotMessage(
          'How can we assist your emergency or navigation needs right now?',
          [
            { label: '🚑 Medical / Ambulance', emergency: true, action: function () { handleChatIntent('ambulance'); } },
            { label: '🚓 Police Assistance', emergency: true, action: function () { handleChatIntent('police'); } },
            { label: '🚒 Fire & Rescue', emergency: true, action: function () { handleChatIntent('fire'); } },
            { label: '📍 My Current Location', action: function () { handleChatIntent('my_location'); } },
            { label: '☎️ Official 911 Hotlines', action: function () { handleChatIntent('hotlines'); } },
            { label: '🩹 First Aid Guide', action: function () { handleChatIntent('first_aid'); } },
            {
              label: '❌ No (End Chat)',
              secondary: true,
              action: function () {
                appendUserMessage('No');
                endAssistanceChat('Understood. Closing emergency assistance. Stay safe!');
              }
            }
          ]
        );
      }, 500);
    }

    function handleChatIntent(intent, userText) {
      if (intent === 'dispatch' || intent === 'main_menu') {
        displayEmergencyAssistanceDispatchMenu();
        return;
      } else if (intent === 'specialties_menu') {
        displayDoctorSpecialtiesChatMenu();
        return;
      } else if (intent === 'specialized_facilities_menu') {
        displaySpecializedFacilitiesChatMenu();
        return;
      } else if (intent === 'end_chat' || intent === 'close_chat') {
        endAssistanceChat('Understood. Closing emergency assistance. Stay safe!');
        return;
      } else if (intent === 'ambulance') {
        appendBotMessage(
          '🚑 <strong>Requesting Ambulance & Medical Response...</strong><br>' +
          'Querying closest hospitals, emergency clinics, and ambulance units to your position.'
        );
        findFastestEmergencyService('ambulance');
        setTimeout(function () {
          const origin = routeOrigin || initialCenter;
          const originPoint = L.latLng(origin[1], origin[0]);
          const nearest = KNOWN_EMERGENCY_FACILITIES.filter(function (f) { return f.type === 'ambulance'; })
            .map(function (f) {
              return {
                facility: f,
                dist: originPoint.distanceTo(L.latLng(f.coordinates[1], f.coordinates[0]))
              };
            })
            .sort(function (a, b) { return a.dist - b.dist; })[0];

          if (nearest) {
            const distKm = (nearest.dist / 1000).toFixed(1);
            appendBotMessage(
              '📍 Nearest Ambulance Base: <strong>' + escapeHtml(nearest.facility.name) + '</strong><br>' +
              '• Distance: ' + distKm + ' km away<br>' +
              '• Address: ' + escapeHtml(nearest.facility.address) + '<br>' +
              '• Contact: ' + escapeHtml(nearest.facility.phone),
              [
                {
                  label: '🗺️ Route Now',
                  emergency: true,
                  action: function () {
                    activateEmergencyRouteFromChat(nearest.facility.name, nearest.facility.coordinates, nearest.facility, 'ambulance');
                  }
                },
                {
                  label: '📞 Call ' + nearest.facility.phone,
                  href: 'tel:' + nearest.facility.phone.replace(/[^\d+*#;]/g, '')
                },
                {
                  label: '🚨 Call 911',
                  href: 'tel:911',
                  emergency: true
                }
              ]
            );
          }
        }, 400);
      } else if (intent === 'police') {
        appendBotMessage(
          '🚓 <strong>Searching nearest Police Stations & PNP Precincts...</strong><br>' +
          'Locating law enforcement units nearest to your position.'
        );
        findFastestEmergencyService('police');
        setTimeout(function () {
          const origin = routeOrigin || initialCenter;
          const originPoint = L.latLng(origin[1], origin[0]);
          const nearest = KNOWN_EMERGENCY_FACILITIES.filter(function (f) { return f.type === 'police'; })
            .map(function (f) {
              return {
                facility: f,
                dist: originPoint.distanceTo(L.latLng(f.coordinates[1], f.coordinates[0]))
              };
            })
            .sort(function (a, b) { return a.dist - b.dist; })[0];

          if (nearest) {
            const distKm = (nearest.dist / 1000).toFixed(1);
            appendBotMessage(
              '📍 Nearest Police Station: <strong>' + escapeHtml(nearest.facility.name) + '</strong><br>' +
              '• Distance: ' + distKm + ' km away<br>' +
              '• Address: ' + escapeHtml(nearest.facility.address) + '<br>' +
              '• Contact: ' + escapeHtml(nearest.facility.phone),
              [
                {
                  label: '🗺️ Route to Station',
                  emergency: true,
                  action: function () {
                    activateEmergencyRouteFromChat(nearest.facility.name, nearest.facility.coordinates, nearest.facility, 'police');
                  }
                },
                {
                  label: '📞 Call ' + nearest.facility.phone,
                  href: 'tel:' + nearest.facility.phone.replace(/[^\d+*#;]/g, '')
                },
                {
                  label: '🚨 Call 911',
                  href: 'tel:911',
                  emergency: true
                }
              ]
            );
          }
        }, 400);
      } else if (intent === 'fire') {
        appendBotMessage(
          '🚒 <strong>Searching nearest Fire Stations & BFP Engines...</strong><br>' +
          'Locating fire protection services nearest to your position.'
        );
        findFastestEmergencyService('fire');
        setTimeout(function () {
          const origin = routeOrigin || initialCenter;
          const originPoint = L.latLng(origin[1], origin[0]);
          const nearest = KNOWN_EMERGENCY_FACILITIES.filter(function (f) { return f.type === 'fire'; })
            .map(function (f) {
              return {
                facility: f,
                dist: originPoint.distanceTo(L.latLng(f.coordinates[1], f.coordinates[0]))
              };
            })
            .sort(function (a, b) { return a.dist - b.dist; })[0];

          if (nearest) {
            const distKm = (nearest.dist / 1000).toFixed(1);
            appendBotMessage(
              '📍 Nearest Fire Station: <strong>' + escapeHtml(nearest.facility.name) + '</strong><br>' +
              '• Distance: ' + distKm + ' km away<br>' +
              '• Address: ' + escapeHtml(nearest.facility.address) + '<br>' +
              '• BFP Hotline: ' + escapeHtml(nearest.facility.phone),
              [
                {
                  label: '🗺️ Route to Station',
                  emergency: true,
                  action: function () {
                    activateEmergencyRouteFromChat(nearest.facility.name, nearest.facility.coordinates, nearest.facility, 'fire');
                  }
                },
                {
                  label: '📞 Call ' + nearest.facility.phone,
                  href: 'tel:' + nearest.facility.phone.replace(/[^\d+*#;]/g, '')
                },
                {
                  label: '🚨 Call 911',
                  href: 'tel:911',
                  emergency: true
                }
              ]
            );
          }
        }, 400);
      } else if (intent === 'responder' || (intent && intent.indexOf('responder-scenario:') === 0)) {
        let scenario = currentResponderScenario || 'flood';
        if (intent && intent.indexOf('responder-scenario:') === 0) {
          scenario = intent.split(':')[1];
          currentResponderScenario = scenario;
        }
        const dispatchData = recommendResponderDispatch(userText || '', scenario);
        appendBotMessage(
          '🛟 <strong>Disaster & Rescue Dispatch Assessment</strong><br>' +
          'Based on where you are currently located detected on the map and your reported situation, here is the fastest response route recommendation:',
          [
            { label: '🌊 Flood / Water Rise', action: function () { handleChatIntent('responder-scenario:flood'); } },
            { label: '🚗 Trapped / Crash', action: function () { handleChatIntent('responder-scenario:accident'); } },
            { label: '🚑 Medical Trauma', action: function () { handleChatIntent('responder-scenario:medical'); } },
            { label: '🌀 Storm Evacuation', action: function () { handleChatIntent('responder-scenario:storm'); } },
            { label: '🏚️ Structural Collapse', action: function () { handleChatIntent('responder-scenario:debris'); } }
          ]
        );
        if (dispatchData && dispatchData.html) {
          appendBotMessage(dispatchData.html);
        }
      } else if (intent === 'hotlines') {
        appendBotMessage(
          '☎️ <strong>Official Emergency Hotlines:</strong><br>' +
          '• <strong>National Emergency:</strong> 911<br>' +
          '• <strong>Iloilo City CDRRMO:</strong> (033) 333-1111<br>' +
          '• <strong>Philippine Red Cross:</strong> (033) 337-5976 / 143<br>' +
          '• <strong>Iloilo City Police (ICPO):</strong> (033) 337-0400<br>' +
          '• <strong>BFP Fire Department:</strong> (033) 337-4444<br>' +
          '• <strong>Coast Guard District:</strong> (033) 337-5264',
          [
            { label: '📞 Call 911', href: 'tel:911', emergency: true },
            { label: '📞 Call CDRRMO', href: 'tel:0333331111' },
            { label: '📞 Call Red Cross', href: 'tel:0333375976' },
            { label: '📞 Call Police', href: 'tel:0333370400' },
            { label: '📞 Call Fire Dept', href: 'tel:0333374444' }
          ]
        );
      } else if (intent && intent.startsWith('specialty:')) {
        const specId = intent.split(':')[1];
        answerUserEmergencyQuestion(specId);
      } else if (intent && intent.startsWith('category:')) {
        const catId = intent.split(':')[1];
        if (catId === 'healthMentalHealth') {
          answerUserEmergencyQuestion('mental health');
        } else {
          answerUserEmergencyQuestion(catId);
        }
      } else if (intent === 'my_location') {
        answerUserEmergencyQuestion('where am i');
      } else if (intent === 'traffic_conditions') {
        answerUserEmergencyQuestion('is there traffic');
      } else if (intent === 'travel_factors') {
        answerUserEmergencyQuestion('what factors affect travel time');
      } else if (intent === 'first_aid') {
        appendBotMessage(
          '🩹 <strong>First Aid Quick Guides:</strong><br>' +
          'Select an emergency topic below for immediate step-by-step guidance:',
          [
            { label: '🌊 Drowning Rescue', emergency: true, action: function () { answerUserEmergencyQuestion('drowning'); } },
            { label: '🫀 CPR / Cardiac Arrest', emergency: true, action: function () { answerUserEmergencyQuestion('cpr'); } },
            { label: '🗣️ Choking (Heimlich)', emergency: true, action: function () { answerUserEmergencyQuestion('choking'); } },
            { label: '🩸 Stop Heavy Bleeding', emergency: true, action: function () { answerUserEmergencyQuestion('bleeding'); } },
            { label: '🔥 Burn Treatment', action: function () { answerUserEmergencyQuestion('burn'); } },
            { label: '🦴 Fractures & Sprains', action: function () { answerUserEmergencyQuestion('fracture'); } },
            { label: '⚠️ Severe Allergy / Anaphylaxis', action: function () { answerUserEmergencyQuestion('allergy'); } },
            { label: '☀️ Heat Stroke & Exhaustion', action: function () { answerUserEmergencyQuestion('heat stroke'); } },
            { label: '⚡ Electric Shock', action: function () { answerUserEmergencyQuestion('electric shock'); } },
            { label: '🧪 Poisoning & Ingestion', action: function () { answerUserEmergencyQuestion('poisoning'); } },
            { label: '🐕 Animal / Snake Bite', action: function () { answerUserEmergencyQuestion('dog bite'); } },
            { label: '🧠 Stroke Signs (F.A.S.T.)', action: function () { answerUserEmergencyQuestion('stroke'); } },
            { label: '⚠️ Seizures / Convulsions', action: function () { answerUserEmergencyQuestion('seizure'); } },
            { label: '🫁 Asthma / Breathing', action: function () { answerUserEmergencyQuestion('asthma'); } },
            { label: '🚑 Call Ambulance', emergency: true, action: function () { handleChatIntent('ambulance'); } }
          ]
        );
      } else if (intent === 'route') {
        if (destinationInput && destinationInput.value) {
          const destVal = destinationInput.value.trim().toLowerCase();
          const matchedFacility = (typeof KNOWN_EMERGENCY_FACILITIES !== 'undefined')
            ? KNOWN_EMERGENCY_FACILITIES.find(function (f) {
                const lowerF = f.name.toLowerCase();
                return lowerF === destVal || lowerF.includes(destVal) || destVal.includes(lowerF);
              })
            : null;
          displayFacilityRouteInChat(matchedFacility || { name: destinationInput.value });
        } else {
          appendBotMessage(
            'Please select an emergency facility from the map or enter a destination to calculate the fastest factor-aware route:',
            [
              { label: '🚑 Nearest Hospital', action: function () { handleChatIntent('ambulance'); } },
              { label: '🚓 Nearest Police', action: function () { handleChatIntent('police'); } },
              { label: '🚒 Nearest Fire Station', action: function () { handleChatIntent('fire'); } }
            ]
          );
        }
      } else {
        answerUserEmergencyQuestion(userText);
      }
    }

    if (chatboxInputForm) {
      chatboxInputForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const text = (chatboxInput.value || '').trim();
        if (!text) return;
        appendUserMessage(text);
        broadcastUserEmergencyActivity('chat_message', {
          userMessage: text,
          actionDescription: 'Caller reported via chat: "' + (text.length > 35 ? text.slice(0, 35) + '...' : text) + '"'
        });
        chatboxInput.value = '';
        setTimeout(function () {
          handleChatIntent(null, text);
        }, 200);
      });
    }

    if (chatboxCloseBtn) {
      chatboxCloseBtn.addEventListener('click', closeAssistanceChat);
    }
    if (chatboxMinBtn) {
      chatboxMinBtn.addEventListener('click', closeAssistanceChat);
    }
    if (assistanceChatFloatingBtn) {
      assistanceChatFloatingBtn.addEventListener('click', function () {
        openAssistanceChat();
      });
    }
    if (emergencyOpenChat) {
      emergencyOpenChat.addEventListener('click', function () {
        collapseSidebar();
        openAssistanceChat();
      });
    }

    // --- Responder Dispatch & Route Recommendation Controller ---
    let currentResponderScenario = 'flood';
    const emergencyDispatchChannel = (typeof window !== 'undefined' && window.BroadcastChannel)
      ? new BroadcastChannel('emergency_dispatch')
      : null;

    let lastEmergencyActionTime = 0;
    let lastClearedTimestamp = 0;

    function subscribeToOwnEmergencyAlert(userId) {
      if (!supabaseClient || !userId || !supabaseClient.channel) return;
      if (ownEmergencyAlertChannel) supabaseClient.removeChannel(ownEmergencyAlertChannel);
      ownEmergencyAlertChannel = supabaseClient
        .channel('caller-alert-' + userId)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'alerts',
          filter: 'user_id=eq.' + userId
        }, function (change) {
          if (change.new && change.new.status === 'cleared' && isCurrentEmergencyConfirmed) {
            lastClearedTimestamp = Date.now();
            clearEmergencyRoute(true);
          }
        })
        .subscribe();
    }

    async function saveEmergencyAlert(state, actionType) {
      if (!supabaseClient || !currentUser) {
        setStatus('Sign in to sync confirmed emergency alerts to responder devices.');
        return;
      }
      const result = await supabaseClient.from('alerts').upsert({
        user_id: currentUser.id,
        payload: actionType === 'emergency_cleared'
          ? { isConfirmed: false, lastAction: 'emergency_cleared' }
          : state,
        status: actionType === 'emergency_cleared' ? 'cleared' : 'active',
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
      if (result.error) {
        console.error('Could not synchronize emergency alert:', result.error);
        setStatus('Emergency remains local: cloud alert sync failed. ' + result.error.message);
      }
    }

    if (emergencyDispatchChannel) {
      try {
        emergencyDispatchChannel.onmessage = function (ev) {
          // When responder clicks cleared in responder.html, automatically reflect it in map.html (desktop & mobile)
          if (ev && ev.data && ev.data.type === 'MISSION_CLEARED') {
            const clearedTime = (ev.data && ev.data.timestamp) || Date.now();
            if (clearedTime >= lastEmergencyActionTime && clearedTime > lastClearedTimestamp) {
              lastClearedTimestamp = clearedTime;
              clearEmergencyRoute(true);
            }
          }
        };
      } catch (e) {}
    }
    window.addEventListener('storage', function (e) {
      // Only trigger if a new valid timestamp was written (never when key is removed)
      if (e.key === 'responder_cleared_time' && e.newValue) {
        const clearedTime = Number(e.newValue);
        if (clearedTime && clearedTime >= lastEmergencyActionTime && clearedTime > lastClearedTimestamp) {
          lastClearedTimestamp = clearedTime;
          clearEmergencyRoute(true);
        }
      }
    });

    let lastResponderDispatchData = null;

    function broadcastUserEmergencyActivity(actionType, extraData) {
      try {
        // If caller has not confirmed emergency, do not broadcast route preview / facility selection actions to responder
        if (!isCurrentEmergencyConfirmed && (actionType === 'facility_route_selected' || actionType === 'search' || actionType === 'situation_change')) {
          return;
        }
        const userLoc = typeof getDetectedUserLocation === 'function' ? getDetectedUserLocation() : {
          coords: [122.5368, 10.7196],
          lat: 10.7196,
          lng: 122.5368,
          districtName: 'Mandurriao District',
          formattedCoords: '10.7196° N, 122.5368° E'
        };

        const currentRaw = localStorage.getItem('tracked_user_emergency');
        let state = currentRaw ? JSON.parse(currentRaw) : {};

        state.lastAction = actionType;
        state.lastActionTime = Date.now();
        state.lat = userLoc.lat;
        state.lng = userLoc.lng;
        state.coords = userLoc.formattedCoords || (userLoc.lat.toFixed(4) + '° N, ' + userLoc.lng.toFixed(4) + '° E');
        state.district = userLoc.districtName;
        state.timestamp = Date.now();
        state.isConfirmed = Boolean(isCurrentEmergencyConfirmed);

        if (extraData) {
          for (const key in extraData) {
            state[key] = extraData[key];
          }
        }

        if (!Array.isArray(state.activityLog)) {
          state.activityLog = [];
        }

        if (extraData && extraData.actionDescription) {
          state.activityLog.unshift({
            desc: extraData.actionDescription,
            time: Date.now(),
            type: actionType
          });
          if (state.activityLog.length > 20) {
            state.activityLog.length = 20;
          }
        }

        localStorage.setItem('tracked_user_emergency', JSON.stringify(state));

        if (emergencyDispatchChannel) {
          emergencyDispatchChannel.postMessage({ type: 'USER_ACTIVITY_SYNC', data: state });
        }
        if (state.isConfirmed || actionType === 'emergency_cleared') {
          initializeAccount().then(function () {
            return saveEmergencyAlert(state, actionType);
          }).catch(function (error) {
            console.error('Could not initialize emergency alert sync:', error);
          });
        }
      } catch (err) {
        console.warn('Could not broadcast user activity:', err);
      }
    }

    function getDetectedUserLocation() {
      let coords = null;
      let sourceName = 'Detected Location';

      if (userLocationMarker && typeof userLocationMarker.getLatLng === 'function') {
        const latlng = userLocationMarker.getLatLng();
        coords = [latlng.lng, latlng.lat];
        sourceName = 'GPS Device Location';
      } else if (userDeviceCoords && Array.isArray(userDeviceCoords)) {
        coords = userDeviceCoords;
        sourceName = 'Device Coordinates';
      } else if (routeOrigin && Array.isArray(routeOrigin)) {
        coords = routeOrigin;
        sourceName = 'Selected Starting Point';
      } else if (initialCenter && Array.isArray(initialCenter)) {
        coords = initialCenter;
        sourceName = 'City Center Anchor';
      } else {
        const center = map.getCenter();
        coords = [center.lng, center.lat];
        sourceName = 'Map Viewport Center';
      }

      const landmarks = [
        { name: 'Mandurriao District', lat: 10.7196, lng: 122.5368, streets: 'Benigno Aquino Ave / Guzman St' },
        { name: 'Molo District', lat: 10.6977, lng: 122.5458, streets: 'Locsin St / M.H. del Pilar St' },
        { name: 'Iloilo City Proper', lat: 10.6957, lng: 122.5684, streets: 'General Luna St / Iznart St' },
        { name: 'Jaro District', lat: 10.7253, lng: 122.5574, streets: 'E. Lopez St / Commission Civil St' },
        { name: 'La Paz District', lat: 10.7118, lng: 122.5691, streets: 'Huervana St / Luna St' },
        { name: 'Villa Arevalo District', lat: 10.6865, lng: 122.5186, streets: 'Quezon St / Osmeña St' },
        { name: 'Lapuz / Port Area', lat: 10.7012, lng: 122.5794, streets: 'Bo. Obrero / Lapuz Norte' },
        { name: 'Oton Municipality', lat: 10.6951, lng: 122.4770, streets: 'Mabini St / National Highway' }
      ];

      let nearestLandmark = landmarks[0];
      let minD = Infinity;
      landmarks.forEach(function (lm) {
        const d = haversineMeters(coords[1], coords[0], lm.lat, lm.lng);
        if (d < minD) {
          minD = d;
          nearestLandmark = lm;
        }
      });

      const formattedCoords = coords[1].toFixed(4) + '° N, ' + coords[0].toFixed(4) + '° E';
      const label = nearestLandmark.name + ' (' + formattedCoords + ')';

      return {
        coords: coords,
        lat: coords[1],
        lng: coords[0],
        sourceName: sourceName,
        districtName: nearestLandmark.name,
        streetRef: nearestLandmark.streets,
        formattedCoords: formattedCoords,
        label: label
      };
    }

    function analyzeSituationReport(scenarioType, customText) {
      const q = (customText || '').toLowerCase();
      let type = scenarioType || 'flood';

      if (customText) {
        if (/flood|water|submerge|drown|river|rising|rain|gutter|knee|waist|chest/i.test(q)) {
          type = 'flood';
        } else if (/car|vehicle|crash|accident|collision|trapped|pinned|rollover/i.test(q)) {
          type = 'accident';
        } else if (/injur|bleed|head|wound|unconscious|heart|cardiac|stroke|breath|burn|trauma/i.test(q)) {
          type = 'medical';
        } else if (/storm|typhoon|wind|roof|cyclone|tree|gale|blow/i.test(q)) {
          type = 'storm';
        } else if (/collapse|wall|building|debris|rubble|fall|crack|landslide/i.test(q)) {
          type = 'debris';
        }
      }

      const scenarios = {
        flood: {
          key: 'flood',
          title: '🌊 Flash Flood & Water Evacuation',
          severity: 'Code Red · Immediate Water Extraction',
          summary: customText ? 'Report received: "' + customText + '". Water rise threatening location. Civilian transport impossible.' : 'Severe water rise / flash flooding reported in caller area. Standard road vehicles unable to navigate submerged segments.',
          equipment: 'Amphibious Rubber Boats (Zodiac), High-Clearance 4x4 Rescue Truck, Floatation Vests & Ropes',
          tacticalAdvice: 'Move to highest elevation available. Avoid wading into moving floodwaters or submerged electrical wiring.',
          preferredKeywords: ['rescue', 'operations', 'disaster', 'coast guard', 'red cross']
        },
        accident: {
          key: 'accident',
          title: '🚗 Vehicular Accident & Extrication',
          severity: 'Code Red · Emergency Vehicle Extrication',
          summary: customText ? 'Report received: "' + customText + '". Vehicle collision with trapped occupants requiring urgent extrication.' : 'Major vehicular collision reported. Entrapped occupants requiring hydraulic rescue tools and emergency airway stabilization.',
          equipment: 'Hydraulic Cutters/Spreaders (Jaws of Life), Advanced Life Support (ALS) Ambulance, Cervical Collars',
          tacticalAdvice: 'Do not attempt to pull entrapped victims without cervical stabilization unless active fire risk is present.',
          preferredKeywords: ['rescue', 'operations', 'disaster', 'emergency response']
        },
        medical: {
          key: 'medical',
          title: '🚑 Acute Trauma & Emergency Medical Evacuation',
          severity: 'Code Red · Rapid Medical Extraction',
          summary: customText ? 'Report received: "' + customText + '". Critical medical/trauma event requiring paramedic intervention.' : 'Critical trauma or medical emergency reported at caller coordinates. Urgent need for field triage and rapid transit to tertiary facility.',
          equipment: 'Emergency Medical Crew (EMT-P), Defibrillator/AED, Portable Oxygen, Trauma Splints',
          tacticalAdvice: 'Keep patient calm and still. Apply direct firm pressure with clean cloth to any visible arterial bleeding.',
          preferredKeywords: ['ambulance', 'red cross', 'hospital', 'operations']
        },
        storm: {
          key: 'storm',
          title: '🌀 Severe Storm Damage & Evacuation',
          severity: 'Code Orange · Urgent Disaster Evacuation',
          summary: customText ? 'Report received: "' + customText + '". Structural damage, flying debris, and gale-force wind hazards reported.' : 'Severe storm hazards including roof blow-off, fallen trees, and downed utility poles blocking caller area.',
          equipment: 'Heavy Clearing Chainsaw Unit, Disaster Evacuation Van, Emergency Power Generator, Tarpaulins',
          tacticalAdvice: 'Remain indoors away from windows and glass facades. Watch for downed power lines which may be live.',
          preferredKeywords: ['drrmo', 'operations', 'disaster', 'response']
        },
        debris: {
          key: 'debris',
          title: '🏚️ Structural Collapse & Urban Search & Rescue',
          severity: 'Code Red · Urban Search & Rescue (USAR)',
          summary: customText ? 'Report received: "' + customText + '". Structural failure or wall collapse with potential trapped individuals.' : 'Building compromise or wall collapse reported. Urban Search & Rescue (USAR) unit dispatched with shoring and search gear.',
          equipment: 'Acoustic Listening Detectors, Pneumatic Shoring Jacks, Concrete Breakers, Heavy Rescue Winch',
          tacticalAdvice: 'If trapped, tap rhythmically on pipes or walls rather than shouting continuously to conserve oxygen.',
          preferredKeywords: ['cdrmmo', 'operations', 'disaster', 'rescue']
        },
        general: {
          key: 'general',
          title: '🛟 Rapid Emergency Distress & Disaster Response',
          severity: 'Code Orange · Priority Dispatch',
          summary: customText ? 'Report received: "' + customText + '". Urgent response requested.' : 'Emergency assistance call registered. Quick Response Team dispatched to caller location.',
          equipment: 'First Response Unit, Field Command Communications, First Aid Kits',
          tacticalAdvice: 'Keep communication lines clear and remain at the detected location if safe to do so.',
          preferredKeywords: ['operations', 'disaster', 'rescue', 'red cross']
        }
      };

      return scenarios[type] || scenarios.general;
    }

    function findBestResponderFacility(userCoords, scenario) {
      const userPoint = L.latLng(userCoords[1], userCoords[0]);
      const responders = KNOWN_EMERGENCY_FACILITIES.filter(function (f) {
        return f.type === 'responder';
      });

      const scored = responders.map(function (facility) {
        const facPoint = L.latLng(facility.coordinates[1], facility.coordinates[0]);
        const distMeters = userPoint.distanceTo(facPoint);
        let score = distMeters;

        const nameLower = facility.name.toLowerCase();
        if (scenario.key === 'flood' && /coast guard|red cross|cdrmmo/i.test(nameLower)) {
          score *= 0.85;
        }

        return {
          facility: facility,
          distanceMeters: distMeters,
          score: score
        };
      });

      scored.sort(function (a, b) { return a.score - b.score; });
      return scored[0];
    }

    function evaluateRouteHazards(startCoords, endCoords) {
      const hazardsDetected = [];
      const steps = 15;
      for (let i = 0; i <= steps; i++) {
        const ratio = i / steps;
        const lat = startCoords[1] + (endCoords[1] - startCoords[1]) * ratio;
        const lng = startCoords[0] + (endCoords[0] - startCoords[0]) * ratio;

        liveIncidents.forEach(function (inc) {
          const d = haversineMeters(lat, lng, inc.lat, inc.lng);
          if (d <= inc.radius + 80) {
            if (!hazardsDetected.some(function (h) { return h.id === inc.id; })) {
              hazardsDetected.push(inc);
            }
          }
        });
      }

      let hazardAvoidanceNote = 'Direct arterial corridors clear of impassable hazards.';
      let detourSeconds = 0;

      if (hazardsDetected.length > 0) {
        const names = hazardsDetected.map(function (h) { return h.name; }).join(', ');
        const hasImpassable = hazardsDetected.some(function (h) { return h.impassable; });
        const hasFlood = hazardsDetected.some(function (h) { return h.type === 'flood'; });

        if (hasFlood) {
          hazardAvoidanceNote = '⚠️ Active Flash Flood zone detected on Diversion corridor. Fastest response route automatically detoured via elevated bypass.';
          detourSeconds += 150;
        } else if (hasImpassable) {
          hazardAvoidanceNote = '⛔ Active road closure detected (' + names + '). Response unit routed via open peripheral arterial.';
          detourSeconds += 180;
        } else {
          hazardAvoidanceNote = '🚧 Road hazards reported along path (' + names + '). Slow-down caution applied.';
          detourSeconds += 90;
        }
      }

      return {
        hazards: hazardsDetected,
        note: hazardAvoidanceNote,
        detourSeconds: detourSeconds
      };
    }

    function calculateResponderRouteMetrics(startCoords, endCoords, detourSec) {
      const distMeters = haversineMeters(startCoords[1], startCoords[0], endCoords[1], endCoords[0]) * 1.35;
      const baseSpeedKmh = 38;
      const baseSec = Math.round((distMeters / (baseSpeedKmh * 1000 / 3600)));
      const totalSec = baseSec + (detourSec || 0);
      const mins = Math.max(2, Math.round(totalSec / 60));
      const distKm = (distMeters / 1000).toFixed(1);

      return {
        distMeters: distMeters,
        distKm: distKm,
        durationSeconds: totalSec,
        durationMins: mins
      };
    }

    function buildResponderAssessmentHtml(data) {
      return (
        '<div class="responder-dispatch-card">' +
          '<div class="responder-dispatch-header">' +
            '<span class="responder-dispatch-badge">🚨 ' + escapeHtml(data.scenario.severity) + '</span>' +
            '<span class="responder-dispatch-time">⏱️ Fastest ETA: ~' + data.metrics.durationMins + ' min (' + data.metrics.distKm + ' km)</span>' +
          '</div>' +
          '<div class="responder-scenario-title">' + escapeHtml(data.scenario.title) + '</div>' +
          '<div class="responder-assessment-box">' +
            '<div class="assessment-row"><strong>What it looks like based on your report:</strong><br>' +
              '<span style="color:#d93025;font-weight:600;">' + escapeHtml(data.scenario.summary) + '</span>' +
            '</div>' +
            '<div class="assessment-row"><strong>📍 Caller Detected Location:</strong> ' + escapeHtml(data.userLoc.districtName) + ' <span style="color:#5f6368;font-size:10.5px;">(' + escapeHtml(data.userLoc.formattedCoords) + ' · Near ' + escapeHtml(data.userLoc.streetRef) + ')</span></div>' +
            '<div class="assessment-row"><strong>🚨 Assigned Responder Base:</strong> <strong>' + escapeHtml(data.responder.name) + '</strong><br>' +
              '<span style="color:#5f6368;font-size:10.5px;">📍 ' + escapeHtml(data.responder.address) + '</span>' +
            '</div>' +
            '<div class="assessment-row"><strong>🛣️ Recommended Fastest Route:</strong> Dispatched from ' + escapeHtml(data.responder.name) + ' directly to your detected location via fastest clear thoroughfare.' +
            '</div>' +
            '<div class="assessment-row"><strong>🛡️ Hazard & Avoidance Status:</strong> ' + escapeHtml(data.hazardEval.note) + '</div>' +
            '<div class="assessment-row"><strong>🧰 Deployed Gear & Response Team:</strong> ' + escapeHtml(data.scenario.equipment) + '</div>' +
            '<div class="assessment-advice-box"><strong>💡 Immediate Safety Advice:</strong><br><span class="advice-text">' + escapeHtml(data.scenario.tacticalAdvice) + '</span></div>' +
          '</div>' +
          '<div class="responder-actions">' +
            '<button type="button" class="chat-action-btn emergency" data-action="plot-responder-route">🚨 Confirm Emergency & Route</button>' +
            (data.responder.phone ? '<a href="tel:' + data.responder.phone.replace(/[^\d+*#;]/g, '') + '" class="chat-action-btn secondary">📞 Call ' + escapeHtml(data.responder.phone) + '</a>' : '') +
            '<a href="tel:911" class="chat-action-btn emergency">🚨 Call 911</a>' +
          '</div>' +
        '</div>'
      );
    }

    function updateResponderDispatchBanner(data) {
      const banner = document.getElementById('responder-dispatch-banner');
      if (!banner) return;
      if (!data) {
        banner.hidden = true;
        return;
      }
      banner.hidden = false;
      banner.innerHTML = (
        '<div class="responder-banner-title">' +
          '<span>🚨</span> Recommended Responder Route' +
        '</div>' +
        '<div style="font-weight:700;font-size:12px;color:#d93025;">' + escapeHtml(data.scenario.title) + '</div>' +
        '<div style="font-size:11px;color:#3c4043;margin:3px 0;">' +
          '<strong>Situation:</strong> ' + escapeHtml(data.scenario.summary) +
        '</div>' +
        '<div style="font-size:11px;display:flex;flex-direction:column;gap:2px;">' +
          '<div>📍 Caller: <strong>' + escapeHtml(data.userLoc.districtName) + '</strong> (' + escapeHtml(data.userLoc.formattedCoords) + ')</div>' +
          '<div>🚨 Station: <strong>' + escapeHtml(data.responder.name) + '</strong></div>' +
          '<div>⏱️ Fastest ETA: <strong style="color:#188038;">~' + data.metrics.durationMins + ' min (' + data.metrics.distKm + ' km)</strong></div>' +
          '<div style="color:#b3261e;font-size:10.5px;">🛡️ ' + escapeHtml(data.hazardEval.note) + '</div>' +
        '</div>' +
        (data.scenario && data.scenario.tacticalAdvice ? '<div class="assessment-advice-box"><strong>💡 Immediate Safety Advice:</strong><br><span class="advice-text">' + escapeHtml(data.scenario.tacticalAdvice) + '</span></div>' : '') +
        '<div style="display:flex;gap:6px;margin-top:6px;">' +
          '<button type="button" class="emergency-facility-route-btn" data-action="plot-responder-route" style="flex:1;">Active Route</button>' +
          (data.responder.phone ? '<a href="tel:' + data.responder.phone.replace(/[^\d+*#;]/g, '') + '" class="chat-action-btn secondary" style="font-size:11px;padding:3px 8px;text-decoration:none;">📞 Call</a>' : '') +
        '</div>'
      );
    }

    function plotResponderRoute(data) {
      if (!data) return;
      const responder = data.responder;
      const userLoc = data.userLoc;

      if (destinationInput) {
        destinationInput.value = 'Detected Location (' + userLoc.districtName + ')';
      }

      searchDestination(
        'Detected Location (' + userLoc.districtName + ')',
        userLoc.coords,
        { emergencyType: 'responder', dispatchData: data },
        responder.coordinates
      );
    }

    function recommendResponderDispatch(customText, scenarioType) {
      const userLoc = getDetectedUserLocation();
      const scenario = analyzeSituationReport(scenarioType || currentResponderScenario, customText);
      const best = findBestResponderFacility(userLoc.coords, scenario);
      const responder = best.facility;
      const hazardEval = evaluateRouteHazards(responder.coordinates, userLoc.coords);
      const metrics = calculateResponderRouteMetrics(responder.coordinates, userLoc.coords, hazardEval.detourSeconds);

      const dispatchData = {
        userLoc: userLoc,
        scenario: scenario,
        responder: responder,
        hazardEval: hazardEval,
        metrics: metrics
      };

      dispatchData.html = buildResponderAssessmentHtml(dispatchData);
      lastResponderDispatchData = dispatchData;

      updateResponderDispatchBanner(dispatchData);

      // Broadcast and persist tracked user location for responder.html
      try {
        const payload = {
          lat: userLoc.coords[1],
          lng: userLoc.coords[0],
          coords: userLoc.formattedCoords || (userLoc.coords[1].toFixed(4) + '° N, ' + userLoc.coords[0].toFixed(4) + '° E'),
          district: userLoc.districtName,
          scenario: scenario.title,
          summary: scenario.summary,
          tacticalAdvice: scenario.tacticalAdvice,
          serviceType: 'responder',
          assignedResponder: responder,
          targetFacility: responder,
          timestamp: Date.now()
        };
        localStorage.setItem('tracked_user_emergency', JSON.stringify(payload));
        if (emergencyDispatchChannel) {
          emergencyDispatchChannel.postMessage({ type: 'USER_LOCATION_UPDATE', data: payload });
        }
      } catch (e) {
        console.warn('Could not broadcast user emergency to responder:', e);
      }

      return dispatchData;
    }

    // Situation selector chip listener in emergency modal
    const responderSituationSelector = document.getElementById('responder-situation-selector');
    if (responderSituationSelector) {
      // Click on grey empty space inside selector de-selects the scenario option
      responderSituationSelector.addEventListener('click', function (e) {
        e.stopPropagation();
        const clickedChip = e.target.closest('.responder-scenario-chip');
        if (!clickedChip) {
          deSelectResponderScenario();
        }
      });

      responderSituationSelector.querySelectorAll('.responder-scenario-chip').forEach(function (chip) {
        chip.addEventListener('click', function (e) {
          e.stopPropagation();
          const sc = chip.dataset.scenario;
          if (chip.classList.contains('active')) {
            // Clicking already active chip de-selects it
            deSelectResponderScenario();
            return;
          }
          responderSituationSelector.querySelectorAll('.responder-scenario-chip').forEach(function (c) {
            c.classList.remove('active');
          });
          chip.classList.add('active');
          currentResponderScenario = sc;
          const data = recommendResponderDispatch('', sc);
          broadcastUserEmergencyActivity('situation_change', {
            scenarioType: sc,
            scenario: data && data.scenario && data.scenario.title,
            summary: data && data.scenario && data.scenario.summary,
            tacticalAdvice: data && data.scenario && data.scenario.tacticalAdvice,
            actionDescription: 'Selected scenario: ' + ((data && data.scenario && data.scenario.title) || sc)
          });
          if (data) {
            const assistanceContainer = document.getElementById('emergency-assistance-results');
            if (assistanceContainer) {
              const existingCard = assistanceContainer.querySelector('.responder-dispatch-card');
              if (existingCard) {
                const parent = existingCard.parentElement;
                if (parent && parent !== assistanceContainer) {
                  parent.innerHTML = buildResponderAssessmentHtml(data);
                } else {
                  existingCard.outerHTML = buildResponderAssessmentHtml(data);
                }
              } else {
                const assessDiv = document.createElement('div');
                assessDiv.innerHTML = buildResponderAssessmentHtml(data);
                assistanceContainer.prepend(assessDiv);
              }
            }
            plotResponderRoute(data);
            showEmergencyRouteConfirmationBar({
              name: data.responder.name,
              category: data.responder.category,
              distKm: data.metrics.distKm,
              durationMins: data.metrics.durationMins,
              coordinates: data.responder.coordinates,
              phone: data.responder.phone,
              dispatchData: data,
              type: 'responder'
            }, false);
          }
        });
      });
    }

    function deSelectResponderScenario() {
      broadcastUserEmergencyActivity('scenario_deselected', {
        scenario: null,
        summary: 'Emergency scenario de-selected',
        tacticalAdvice: 'Standby for situation report confirmation.',
        actionDescription: 'Cleared scenario selection'
      });
      if (responderSituationSelector) {
        responderSituationSelector.querySelectorAll('.responder-scenario-chip').forEach(function (c) {
          c.classList.remove('active');
        });
      }
      currentResponderScenario = null;
      lastResponderDispatchData = null;
      const assistanceContainer = document.getElementById('emergency-assistance-results');
      if (assistanceContainer) {
        const existingCard = assistanceContainer.querySelector('.responder-dispatch-card');
        if (existingCard) {
          const parent = existingCard.parentElement;
          if (parent && parent !== assistanceContainer) {
            parent.remove();
          } else {
            existingCard.remove();
          }
        }
      }
      const responderBanner = document.getElementById('responder-dispatch-banner');
      if (responderBanner) {
        responderBanner.hidden = true;
        responderBanner.innerHTML = '';
      }
      routeLayers.clearLayers();
      routesElement.replaceChildren();
      if (destinationMarker) {
        map.removeLayer(destinationMarker);
        destinationMarker = null;
      }
      if (destinationInput && /Detected Location/i.test(destinationInput.value)) {
        destinationInput.value = '';
      }
      setStatus('');
    }

    // Floating Emergency Route Confirmation Logic (Route preview before confirming)
    let currentEmergencyTarget = null;
    let emergencyConfirmBarHideTimer = null;
    let isCurrentEmergencyConfirmed = false;

    function showEmergencyRouteConfirmationBar(facilityData, isDirectConfirmed) {
      currentEmergencyTarget = facilityData;
      isCurrentEmergencyConfirmed = Boolean(isDirectConfirmed);

      const bar = document.getElementById('route-emergency-confirm-bar');
      if (!bar) return;

      const badge = document.getElementById('route-confirm-bar-badge');
      const badgeText = document.getElementById('route-confirm-badge-text');
      const facilityTitle = document.getElementById('route-confirm-bar-facility');
      const etaSpan = document.getElementById('route-confirm-bar-eta');
      const distSpan = document.getElementById('route-confirm-bar-dist');
      const promptText = document.getElementById('route-confirm-bar-prompt');
      const confirmBtn = document.getElementById('route-confirm-emergency-btn');
      const cancelBtn = document.getElementById('route-cancel-preview-btn');

      if (facilityTitle) facilityTitle.textContent = facilityData.name || 'Emergency Facility';
      if (etaSpan) etaSpan.textContent = facilityData.durationMins ? ('⏱ ~' + facilityData.durationMins + ' min') : '⏱ Quickest ETA';
      if (distSpan) distSpan.textContent = facilityData.distKm ? ('📍 ' + facilityData.distKm + ' km') : '📍 Nearest Base';

      if (isDirectConfirmed) {
        try {
          localStorage.removeItem('responder_cleared_time');
        } catch (e) {}
        if (badge) badge.classList.add('confirmed');
        if (badgeText) badgeText.textContent = '🚨 Emergency Confirmed · Syncing Alert';
        if (promptText) promptText.textContent = 'Active emergency confirmed. Sign in to sync it to approved responder devices.';
        if (confirmBtn) confirmBtn.hidden = true;
        if (cancelBtn) cancelBtn.textContent = 'End Emergency / Clear Route';

        // Auto-hide confirmation bar after 5 seconds when directly confirmed
        if (typeof emergencyConfirmBarHideTimer !== 'undefined' && emergencyConfirmBarHideTimer) {
          clearTimeout(emergencyConfirmBarHideTimer);
        }
        emergencyConfirmBarHideTimer = setTimeout(function () {
          const bar = document.getElementById('route-emergency-confirm-bar');
          if (bar && isCurrentEmergencyConfirmed) {
            bar.hidden = true;
            if (typeof map !== 'undefined' && map && typeof map.invalidateSize === 'function') {
              map.invalidateSize();
            }
          }
        }, 5000);

        // Direct broadcast confirmed emergency to responder console
        try {
          const userLoc = typeof getDetectedUserLocation === 'function' ? getDetectedUserLocation() : {
            coords: [122.5368, 10.7196],
            lat: 10.7196,
            lng: 122.5368,
            districtName: 'Iloilo City'
          };
          const payload = {
            lat: userLoc.coords[1],
            lng: userLoc.coords[0],
            coords: userLoc.formattedCoords || (userLoc.coords[1].toFixed(4) + '° N, ' + userLoc.coords[0].toFixed(4) + '° E'),
            district: userLoc.districtName,
            scenario: (facilityData.dispatchData && facilityData.dispatchData.scenario && facilityData.dispatchData.scenario.title) || '🚨 Emergency Assistance Request',
            summary: 'Emergency confirmed. Routing to ' + (facilityData.name || 'facility'),
            tacticalAdvice: (facilityData.dispatchData && facilityData.dispatchData.scenario && facilityData.dispatchData.scenario.tacticalAdvice) || 'Keep clear of obstacles and proceed safely.',
            serviceType: facilityData.type || emergencySearchType || 'emergency',
            assignedResponder: facilityData,
            targetFacility: facilityData,
            isConfirmed: true,
            timestamp: Date.now()
          };
          localStorage.setItem('tracked_user_emergency', JSON.stringify(payload));
          if (emergencyDispatchChannel) {
            emergencyDispatchChannel.postMessage({ type: 'USER_LOCATION_UPDATE', data: payload });
          }
        } catch (e) {}

        broadcastUserEmergencyActivity('emergency_confirmed', {
          targetFacility: facilityData,
          isConfirmed: true,
          actionDescription: 'Emergency route active: ' + (facilityData.name || 'nearest facility')
        });
      } else {
        if (badge) badge.classList.remove('confirmed');
        if (badgeText) badgeText.textContent = '⚠️ Emergency Route Preview — Not Yet Confirmed';
        if (promptText) promptText.textContent = 'Inspect the route path on the map above. Confirm below if you have an active emergency.';
        if (confirmBtn) {
          confirmBtn.hidden = false;
          confirmBtn.textContent = '🚨 Confirm Emergency';
        }
        if (cancelBtn) cancelBtn.textContent = 'Cancel Route';
      }

      bar.hidden = false;

      // On mobile viewports, automatically collapse emergency service panel and sidebar so the route path is immediately visible
      if (window.innerWidth <= 640) {
        document.body.classList.add('mobile-route-active');
        collapseEmergencyServicePanel();
        const serviceDetails = document.getElementById('service-details');
        if (serviceDetails) {
          serviceDetails.hidden = true;
          serviceDetails.replaceChildren();
        }
        const mapSearchControls = document.getElementById('map-search-controls');
        if (mapSearchControls) {
          mapSearchControls.classList.remove('sidebar-expanded');
        }
        document.body.classList.remove('sidebar-expanded');
        isSidebarExpanded = false;
        if (typeof map !== 'undefined' && map) {
          setTimeout(function () {
            map.invalidateSize();
            if (typeof routeLayers !== 'undefined' && routeLayers.getBounds && routeLayers.getBounds().isValid()) {
              fitMapBoundsSafely(routeLayers.getBounds(), true);
            }
          }, 150);
        }
      }
    }

    function confirmCurrentEmergencyRoute() {
      if (!currentEmergencyTarget) return;
      isCurrentEmergencyConfirmed = true;

      const badge = document.getElementById('route-confirm-bar-badge');
      const badgeText = document.getElementById('route-confirm-badge-text');
      const promptText = document.getElementById('route-confirm-bar-prompt');
      const confirmBtn = document.getElementById('route-confirm-emergency-btn');
      const cancelBtn = document.getElementById('route-cancel-preview-btn');

      if (badge) badge.classList.add('confirmed');
      if (badgeText) badgeText.textContent = '🚨 Emergency Confirmed · Syncing Alert';
      if (promptText) promptText.textContent = 'Active emergency confirmed. Sign in to sync it to approved responder devices.';
      if (confirmBtn) confirmBtn.hidden = true;
      if (cancelBtn) cancelBtn.textContent = 'End Emergency / Clear Route';

      // Broadcast confirmed emergency to responder console
      const userLoc = getDetectedUserLocation();
      const payload = {
        lat: userLoc.coords[1],
        lng: userLoc.coords[0],
        coords: userLoc.formattedCoords || (userLoc.coords[1].toFixed(4) + '° N, ' + userLoc.coords[0].toFixed(4) + '° E'),
        district: userLoc.districtName,
        scenario: (currentEmergencyTarget.dispatchData && currentEmergencyTarget.dispatchData.scenario && currentEmergencyTarget.dispatchData.scenario.title) || '🚨 Emergency Assistance Request',
        summary: 'Emergency confirmed by user. Navigating to ' + currentEmergencyTarget.name,
        tacticalAdvice: (currentEmergencyTarget.dispatchData && currentEmergencyTarget.dispatchData.scenario && currentEmergencyTarget.dispatchData.scenario.tacticalAdvice) || 'Keep clear of obstacles and proceed safely.',
        serviceType: currentEmergencyTarget.type || emergencySearchType || 'emergency',
        assignedResponder: currentEmergencyTarget,
        targetFacility: currentEmergencyTarget,
        isConfirmed: true,
        timestamp: Date.now()
      };

      try {
        localStorage.setItem('tracked_user_emergency', JSON.stringify(payload));
        if (emergencyDispatchChannel) {
          emergencyDispatchChannel.postMessage({ type: 'USER_LOCATION_UPDATE', data: payload });
        }
      } catch (e) {
        console.warn('Could not store or broadcast emergency:', e);
      }

      broadcastUserEmergencyActivity('emergency_confirmed', {
        targetFacility: currentEmergencyTarget,
        actionDescription: 'Emergency confirmed. Routing to ' + currentEmergencyTarget.name
      });

      setStatus('🚨 Emergency confirmed. Syncing alert for ' + currentEmergencyTarget.name + '.');

      // Auto-hide confirmation bar after 5 seconds as requested, leaving route visible on map
      if (typeof emergencyConfirmBarHideTimer !== 'undefined' && emergencyConfirmBarHideTimer) {
        clearTimeout(emergencyConfirmBarHideTimer);
      }
      emergencyConfirmBarHideTimer = setTimeout(function () {
        const bar = document.getElementById('route-emergency-confirm-bar');
        if (bar && isCurrentEmergencyConfirmed) {
          bar.hidden = true;
          if (typeof map !== 'undefined' && map && typeof map.invalidateSize === 'function') {
            map.invalidateSize();
          }
        }
      }, 5000);
    }

    function clearEmergencyRoute(isFromResponder) {
      try {
        if (typeof emergencyConfirmBarHideTimer !== 'undefined' && emergencyConfirmBarHideTimer) {
          clearTimeout(emergencyConfirmBarHideTimer);
          emergencyConfirmBarHideTimer = null;
        }
        // Prevent repeated clear calls / re-entrant loops
        const bar = document.getElementById('route-emergency-confirm-bar');
        const isBarHidden = !bar || bar.hidden;
        const hasNoLayers = (typeof routeLayers === 'undefined' || !routeLayers || routeLayers.getLayers().length === 0);
        if (isBarHidden && hasNoLayers && !isCurrentEmergencyConfirmed && !currentEmergencyTarget) {
          return;
        }

        document.body.classList.remove('mobile-route-active');
        document.body.classList.remove('emergency-panel-open');
        const mapSearchControls = document.getElementById('map-search-controls');
        if (mapSearchControls) {
          mapSearchControls.classList.remove('sidebar-expanded');
        }
        document.body.classList.remove('sidebar-expanded');
        isSidebarExpanded = false;

        if (bar) bar.hidden = true;

        // Erase route polyline from map safely on both desktop and mobile
        if (typeof routeLayers !== 'undefined' && routeLayers && typeof routeLayers.clearLayers === 'function') {
          routeLayers.clearLayers();
        }

        isSearching = false;
        searchRequestId += 1;
        if (typeof searchButton !== 'undefined' && searchButton) {
          searchButton.disabled = false;
        }

        if (destinationMarker && typeof map !== 'undefined' && map) {
          try {
            map.removeLayer(destinationMarker);
          } catch (e) {}
          destinationMarker = null;
        }
        if (destinationInput) {
          destinationInput.value = '';
        }

        const resultsList = document.getElementById('emergency-results-list');
        if (resultsList) {
          resultsList.hidden = true;
          try { resultsList.replaceChildren(); } catch (e) { resultsList.innerHTML = ''; }
        }
        const assistanceResults = document.getElementById('emergency-assistance-results');
        if (assistanceResults) {
          assistanceResults.hidden = true;
          try { assistanceResults.replaceChildren(); } catch (e) { assistanceResults.innerHTML = ''; }
        }
        if (emergencyAssistance) {
          emergencyAssistance.querySelectorAll('[data-emergency-type]').forEach(function (btn) {
            btn.classList.remove('active');
          });
        }
        const situationSelector = document.getElementById('responder-situation-selector');
        if (situationSelector) {
          situationSelector.hidden = true;
          situationSelector.querySelectorAll('.responder-scenario-chip').forEach(function (c) {
            c.classList.remove('active');
          });
        }
        const emergencyStatusEl = document.getElementById('emergency-status-text');
        if (emergencyStatusEl) {
          emergencyStatusEl.textContent = 'Select an emergency service type below to find the nearest facilities.';
        }
        const emergencyOpenChat = document.getElementById('emergency-open-chat');
        if (emergencyOpenChat) emergencyOpenChat.hidden = false;

        const serviceDetails = document.getElementById('service-details');
        if (serviceDetails) {
          serviceDetails.hidden = true;
          try { serviceDetails.replaceChildren(); } catch (e) { serviceDetails.innerHTML = ''; }
        }
        const routesEl = document.getElementById('routes');
        if (routesEl) {
          try { routesEl.replaceChildren(); } catch (e) { routesEl.innerHTML = ''; }
        }
        const responderBanner = document.getElementById('responder-dispatch-banner');
        if (responderBanner) {
          responderBanner.hidden = true;
          responderBanner.innerHTML = '';
        }

        currentEmergencyTarget = null;
        isCurrentEmergencyConfirmed = false;
        emergencySearchType = null;
        isAssistanceSearch = false;

        // ONLY post to channel if caller manually initiated clear on map.html (DO NOT echo back if from responder!)
        if (!isFromResponder) {
          try {
            localStorage.removeItem('tracked_user_emergency');
            if (emergencyDispatchChannel) {
              emergencyDispatchChannel.postMessage({ type: 'MISSION_CLEARED', timestamp: Date.now() });
            }
          } catch (e) {}

          broadcastUserEmergencyActivity('emergency_cleared', {
            isConfirmed: false,
            actionDescription: 'Emergency route cleared / standby'
          });
        } else {
          // Cleared from responder: just clean local storage safely without echoing back
          try {
            localStorage.removeItem('tracked_user_emergency');
          } catch (e) {}
        }

        if (emergencyOpenButton) {
          emergencyOpenButton.hidden = false;
          emergencyOpenButton.setAttribute('aria-expanded', 'false');
        }
        syncEmergencyOpenButtonVisibility();
        setStatus(isFromResponder ? '🚨 Route cleared by dispatch console. System ready.' : 'Route cleared.');

        // Invalidate map size safely without crashing
        if (typeof map !== 'undefined' && map && typeof map.invalidateSize === 'function') {
          setTimeout(function () {
            map.invalidateSize();
          }, 60);
        }
      } catch (err) {
        console.warn('Safe clearEmergencyRoute error handled:', err);
      }
    }

    const routeConfirmEmergencyBtn = document.getElementById('route-confirm-emergency-btn');
    if (routeConfirmEmergencyBtn) {
      routeConfirmEmergencyBtn.addEventListener('click', function () {
        confirmCurrentEmergencyRoute();
      });
    }

    const routeCancelPreviewBtn = document.getElementById('route-cancel-preview-btn');
    if (routeCancelPreviewBtn) {
      routeCancelPreviewBtn.addEventListener('click', function () {
        clearEmergencyRoute();
      });
    }

    // Global listener for plot-responder-route buttons (Active Route)
    document.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-action="plot-responder-route"]');
      if (btn && lastResponderDispatchData) {
        closeAssistanceChat();
        if (emergencyAssistance) {
          emergencyAssistance.hidden = true;
          document.body.classList.remove('emergency-panel-open');
          if (emergencyOpenButton) {
            emergencyOpenButton.setAttribute('aria-expanded', 'false');
          }
        }
        if (window.innerWidth <= 640) {
          document.body.classList.add('mobile-route-active');
          collapseSidebar();
          if (serviceDetails) {
            serviceDetails.hidden = true;
            serviceDetails.replaceChildren();
          }
        } else {
          expandSidebar();
        }
        syncEmergencyOpenButtonVisibility();
        plotResponderRoute(lastResponderDispatchData);
        showEmergencyRouteConfirmationBar({
          name: lastResponderDispatchData.responder.name,
          category: lastResponderDispatchData.responder.category,
          distKm: lastResponderDispatchData.metrics.distKm,
          durationMins: lastResponderDispatchData.metrics.durationMins,
          coordinates: lastResponderDispatchData.responder.coordinates,
          phone: lastResponderDispatchData.responder.phone,
          dispatchData: lastResponderDispatchData,
          type: 'responder'
        }, false);
        setTimeout(function () {
          if (typeof map !== 'undefined' && map && typeof map.invalidateSize === 'function') {
            map.invalidateSize();
            if (typeof routeLayers !== 'undefined' && routeLayers.getBounds && routeLayers.getBounds().isValid()) {
              fitMapBoundsSafely(routeLayers.getBounds(), true);
            }
          }
        }, 150);
      }
    });

    function setAccountStatus(message) {
      accountStatus.textContent = message;
      historyStatus.textContent = message;
    }

    function setAccountFormMode(signUp) {
      isSignUpMode = signUp;
      signupNameRow.hidden = !signUp;
      signupNameInput.required = signUp;
      accountPasswordInput.autocomplete = signUp ? 'new-password' : 'current-password';
      accountSubmit.textContent = signUp ? 'Create account' : 'Sign in';
      accountModeButton.textContent = signUp ? 'Sign in instead' : 'Create account';
    }

    function getActivityLabel(entry) {
      const payload = entry.payload || {};
      if (entry.activity_type === 'search') return 'Search: ' + (payload.query || 'Unknown query');
      if (entry.activity_type === 'map_style') {
        return 'Map style: ' + (payload.style || 'Unknown') +
          (payload.theme ? ' (' + payload.theme + ' theme)' : '');
      }
      if (entry.activity_type === 'overlay') {
        return 'Overlay: ' + (payload.label || 'Unknown') + (payload.enabled ? ' on' : ' off');
      }
      if (entry.activity_type === 'selected_place') {
        return 'Place: ' + (payload.name || 'Unknown') +
          (payload.category ? ' · ' + payload.category : '');
      }
      return 'Map activity';
    }

    function renderActivityHistory(entries) {
      activityHistory.replaceChildren();
      if (!entries.length) {
        const emptyItem = document.createElement('li');
        emptyItem.textContent = 'No saved activity yet.';
        activityHistory.appendChild(emptyItem);
        return;
      }
      entries.forEach(function (entry) {
        const item = document.createElement('li');
        item.appendChild(document.createTextNode(getActivityLabel(entry)));
        const timestamp = new Date(entry.created_at);
        if (!Number.isNaN(timestamp.getTime())) {
          const time = document.createElement('span');
          time.className = 'activity-time';
          time.textContent = timestamp.toLocaleString();
          item.appendChild(time);
        }
        activityHistory.appendChild(item);
      });
    }

    async function loadActivityHistory(userId) {
      if (!supabaseClient || !currentUser || currentUser.id !== userId) return;
      try {
        const result = await supabaseClient
          .from('map_activity')
          .select('activity_type,payload,created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(100);
        if (result.error) throw result.error;
        const entries = result.data || [];
        if (currentUser && currentUser.id === userId) {
          writeOfflineCache('account-history:' + userId, entries);
          renderActivityHistory(entries);
        }
      } catch (error) {
        console.error('Could not load saved map activity:', error);
        const entries = readOfflineCache('account-history:' + userId, null);
        if (entries) {
          renderActivityHistory(entries);
          setAccountStatus('Showing saved account history offline.');
        } else {
          setAccountStatus('Could not load saved history: ' + error.message);
        }
      }
    }

    function updateRoleBadge(role) {
      if (!accountRoleBadge) return;
      if (role === 'responder') {
        accountRoleBadge.textContent = '🚨 Emergency Responder';
        accountRoleBadge.className = 'account-role-pill responder';
        accountRoleBadge.hidden = false;
        if (accountGoResponder) accountGoResponder.hidden = false;
      } else {
        accountRoleBadge.textContent = '👤 Personal User';
        accountRoleBadge.className = 'account-role-pill personal';
        accountRoleBadge.hidden = false;
        if (accountGoResponder) accountGoResponder.hidden = true;
      }
    }

    async function loadAccountData(userId) {
      if (!supabaseClient || !currentUser || currentUser.id !== userId) return;
      try {
        let result = await supabaseClient
          .from('user_profiles')
          .select('display_name,account_role')
          .eq('user_id', userId)
          .maybeSingle();
        if (result.error) {
          // If account_role column is not yet in user_profiles schema, fallback to display_name
          result = await supabaseClient
            .from('user_profiles')
            .select('display_name')
            .eq('user_id', userId)
            .maybeSingle();
        }
        if (!currentUser || currentUser.id !== userId) return;
        const displayName = result.data && result.data.display_name
          ? result.data.display_name
          : currentUser.user_metadata && currentUser.user_metadata.display_name || '';
        const role = (result.data && result.data.account_role) ||
          (currentUser.user_metadata && currentUser.user_metadata.account_role) ||
          readOfflineCache('account-role:' + userId, readOfflineCache('account-last-role', 'personal'));

        profileNameInput.value = displayName;
        if (profileRoleSelect) profileRoleSelect.value = role;
        updateRoleBadge(role);

        const profileNameDisplay = document.getElementById('account-profile-name');
        const avatarBadge = document.getElementById('account-avatar-badge');
        if (profileNameDisplay) {
          profileNameDisplay.textContent = displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'User');
        }
        if (avatarBadge) {
          const char = (displayName ? displayName[0] : (currentUser.email ? currentUser.email[0] : 'U')).toUpperCase();
          avatarBadge.textContent = char;
        }
        writeOfflineCache('account-profile:' + userId, { display_name: displayName, account_role: role });
        writeOfflineCache('account-role:' + userId, role);
        writeOfflineCache('account-last-role', role);
        await loadActivityHistory(userId);
      } catch (error) {
        console.error('Could not load the account profile:', error);
        const cachedProfile = readOfflineCache('account-profile:' + userId, null);
        const cachedRole = (cachedProfile && cachedProfile.account_role) ||
          readOfflineCache('account-role:' + userId, readOfflineCache('account-last-role', 'personal'));
        if (profileRoleSelect) profileRoleSelect.value = cachedRole;
        updateRoleBadge(cachedRole);

        if (cachedProfile) {
          profileNameInput.value = cachedProfile.display_name || '';
          const profileNameDisplay = document.getElementById('account-profile-name');
          const avatarBadge = document.getElementById('account-avatar-badge');
          if (profileNameDisplay) {
            profileNameDisplay.textContent = cachedProfile.display_name || (currentUser.email ? currentUser.email.split('@')[0] : 'User');
          }
          if (avatarBadge) {
            const char = (cachedProfile.display_name ? cachedProfile.display_name[0] : (currentUser.email ? currentUser.email[0] : 'U')).toUpperCase();
            avatarBadge.textContent = char;
          }
          setAccountStatus('Showing saved account profile offline.');
        } else {
          setAccountStatus('Could not load profile details: ' + error.message);
        }
        await loadActivityHistory(userId);
      }
    }

    function showAccountSession(session) {
      currentUser = session && session.user ? session.user : null;
      let detectedRole = 'personal';
      if (currentUser) {
        detectedRole = (currentUser.user_metadata && currentUser.user_metadata.account_role) ||
          readOfflineCache('account-role:' + currentUser.id, readOfflineCache('account-last-role', 'personal'));
        writeOfflineCache('account-session:' + currentUser.id, session);
        writeOfflineCache('account-session-last', session);
        writeOfflineCache('account-last-email', currentUser.email || '');
        writeOfflineCache('account-role:' + currentUser.id, detectedRole);
        writeOfflineCache('account-last-role', detectedRole);
      }
      const isSignedIn = Boolean(currentUser);
      accountLoggedOut.hidden = isSignedIn;
      accountLoggedIn.hidden = !isSignedIn;
      historyLoggedOut.hidden = isSignedIn;
      historyLoggedIn.hidden = !isSignedIn;

      const avatarBadge = document.getElementById('account-avatar-badge');
      const profileNameDisplay = document.getElementById('account-profile-name');
      const syncStatusPill = document.getElementById('account-sync-status');

      if (!isSignedIn) {
        if (ownEmergencyAlertChannel && supabaseClient) {
          supabaseClient.removeChannel(ownEmergencyAlertChannel);
          ownEmergencyAlertChannel = null;
        }
        accountForm.hidden = true;
        accountOpenForm.hidden = false;
        accountIdentity.textContent = '';
        profileNameInput.value = '';
        if (accountRoleBadge) accountRoleBadge.hidden = true;
        if (accountGoResponder) accountGoResponder.hidden = true;
        activityHistory.replaceChildren();
        if (accountToggle) {
          accountToggle.classList.remove('signed-in');
          accountToggle.setAttribute('title', 'Account & Sync');
        }
        return;
      }

      accountForm.hidden = true;
      const email = currentUser.email || '';
      const initial = (currentUser.user_metadata && currentUser.user_metadata.display_name
        ? currentUser.user_metadata.display_name[0]
        : (email ? email[0] : 'U')).toUpperCase();

      if (avatarBadge) avatarBadge.textContent = initial;
      if (profileNameDisplay) {
        profileNameDisplay.textContent = (currentUser.user_metadata && currentUser.user_metadata.display_name) ||
          (email ? email.split('@')[0] : 'User');
      }
      accountIdentity.textContent = email;
      updateRoleBadge(detectedRole);
      if (profileRoleSelect) profileRoleSelect.value = detectedRole;

      if (accountToggle) {
        accountToggle.classList.add('signed-in');
        accountToggle.setAttribute('title', 'Signed in as ' + (currentUser.user_metadata && currentUser.user_metadata.display_name || email) + ' (' + (detectedRole === 'responder' ? 'Responder' : 'Personal') + ')');
      }
      if (syncStatusPill) {
        if (navigator.onLine) {
          syncStatusPill.className = 'account-sync-badge';
          syncStatusPill.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" fill="none" stroke-width="2.5" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg><span>Cloud Synced</span>';
        } else {
          syncStatusPill.className = 'account-sync-badge offline';
          syncStatusPill.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" fill="none" stroke-width="2.5" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle></svg><span>Offline Saved</span>';
        }
      }

      setAccountStatus('Signed in as ' + (detectedRole === 'responder' ? 'Emergency Responder' : 'Personal User') + '.');
      subscribeToOwnEmergencyAlert(currentUser.id);
      if (authModalOverlay && !authModalOverlay.hidden) {
        closeAuthModal();
      }
      const userId = currentUser.id;
      window.setTimeout(function () { loadAccountData(userId); }, 0);
    }

    async function recordActivity(activityType, payload, eventUserId) {
      const userId = eventUserId || (currentUser && currentUser.id);
      if (!supabaseClient || !userId) return;
      const cachedEntries = readOfflineCache('account-history:' + userId, []);
      cachedEntries.unshift({
        activity_type: activityType,
        payload: payload,
        created_at: new Date().toISOString()
      });
      writeOfflineCache('account-history:' + userId, cachedEntries.slice(0, 100));
      renderActivityHistory(cachedEntries.slice(0, 100));
      try {
        const result = await supabaseClient.from('map_activity').insert({
          user_id: userId,
          activity_type: activityType,
          payload: payload
        });
        if (result.error) throw result.error;
        if (currentUser && currentUser.id === userId && !accountLoggedIn.hidden) {
          await loadActivityHistory(userId);
        }
      } catch (error) {
        console.error('Could not save map activity:', error);
        setAccountStatus('Could not save history: ' + error.message);
      }
    }

    let accountInitializationPromise = null;
    function initializeAccount() {
      if (!accountInitializationPromise) {
        accountInitializationPromise = initializeAccountClient();
      }
      return accountInitializationPromise;
    }

    async function initializeAccountClient() {
      const config = window.OSM_MAP_SUPABASE_CONFIG;
      if (!config || !config.url || !config.anonKey) {
        if (accountOpenForm) accountOpenForm.disabled = true;
        setAccountStatus('Configure the Supabase project URL and public anon key to enable accounts.');
        return;
      }
      if (!window.supabase || typeof window.supabase.createClient !== 'function') {
        try {
          await loadScriptOnce('Supabase client', 'vendor/supabase/supabase.min.js', function () {
            return Boolean(window.supabase && typeof window.supabase.createClient === 'function');
          });
        } catch (error) {
          console.warn('Supabase client could not be loaded:', error);
        }
      }
      if (!window.supabase || typeof window.supabase.createClient !== 'function') {
        const cachedSession = readOfflineCache('account-session-last', null);
        if (!navigator.onLine && cachedSession && cachedSession.user) {
          currentUser = cachedSession.user;
          accountLoggedOut.hidden = true;
          accountLoggedIn.hidden = false;
          historyLoggedOut.hidden = true;
          historyLoggedIn.hidden = false;
          accountIdentity.textContent = 'Signed in as ' + (currentUser.email || 'user');
          setAccountStatus('Showing saved account data offline.');
          const cachedProfile = readOfflineCache('account-profile:' + currentUser.id, null);
          if (cachedProfile) profileNameInput.value = cachedProfile.display_name || '';
          renderActivityHistory(readOfflineCache('account-history:' + currentUser.id, []));
        } else {
          if (accountOpenForm) accountOpenForm.disabled = true;
          setAccountStatus('Supabase could not be loaded. Check your connection and reload.');
        }
        return;
      }

      try {
        supabaseClient = window.supabase.createClient(config.url, config.anonKey);
        const result = await supabaseClient.auth.getSession();
        if (result.error) throw result.error;
        showAccountSession(result.data.session);
        supabaseClient.auth.onAuthStateChange(function (_event, session) {
          showAccountSession(session);
        });
      } catch (error) {
        console.error('Could not initialize Supabase account support:', error);
        const cachedSession = readOfflineCache('account-session-last', null);
        if (!navigator.onLine && cachedSession && cachedSession.user) {
          showAccountSession(cachedSession);
          setAccountStatus('Signed in using saved account data offline.');
        } else {
          if (accountOpenForm) accountOpenForm.disabled = true;
          setAccountStatus('Could not connect to account storage: ' + error.message);
        }
      }
    }

    /* -------------------------------------------------------------------------
       Dedicated Sign-In / Log-In Interface Logic & Role-Based Routing
       ------------------------------------------------------------------------- */
    function getResponderConsoleUrl() {
      return 'responder.html';
    }

    function getMapAppUrl() {
      return 'map.html';
    }

    function redirectBasedOnRole(role, isSignUp) {
      const targetRole = role === 'responder' ? 'responder' : 'personal';
      writeOfflineCache('account-last-role', targetRole);
      if (currentUser) {
        writeOfflineCache('account-role:' + currentUser.id, targetRole);
      }
      updateRoleBadge(targetRole);

      if (targetRole === 'responder') {
        setAuthModalStatus('🚨 Emergency Responder verified! Directing to Responder Console...', 'success');
        setTimeout(function () {
          window.location.href = getResponderConsoleUrl();
        }, 750);
      } else {
        const isAlreadyOnMap = window.location.pathname.endsWith('map.html') || window.location.pathname.endsWith('/');
        if (!isAlreadyOnMap) {
          setAuthModalStatus('Personal account verified. Directing to Map...', 'success');
          setTimeout(function () {
            window.location.href = getMapAppUrl();
          }, 500);
        } else {
          setAuthModalStatus(isSignUp ? 'Account created! Welcome to Open Street Map.' : 'Signed in as Personal User.', 'success');
          setTimeout(function () {
            closeAuthModal();
            setAccountStatus('Signed in as Personal User.');
          }, 450);
        }
      }
    }

    function setSignupRole(role) {
      selectedSignupRole = role === 'responder' ? 'responder' : 'personal';
      if (authRolePersonal) authRolePersonal.checked = selectedSignupRole === 'personal';
      if (authRoleResponder) authRoleResponder.checked = selectedSignupRole === 'responder';
      if (authRoleCardPersonal) {
        authRoleCardPersonal.classList.toggle('active', selectedSignupRole === 'personal');
      }
      if (authRoleCardResponder) {
        authRoleCardResponder.classList.toggle('active', selectedSignupRole === 'responder');
      }
    }

    function setPortalMode(mode) {
      selectedPortalMode = mode === 'responder' ? 'responder' : 'personal';
      if (authPortalMap) {
        authPortalMap.classList.toggle('active', selectedPortalMode === 'personal');
        authPortalMap.setAttribute('aria-pressed', selectedPortalMode === 'personal');
      }
      if (authPortalResponder) {
        authPortalResponder.classList.toggle('active', selectedPortalMode === 'responder');
        authPortalResponder.setAttribute('aria-pressed', selectedPortalMode === 'responder');
      }
    }

    function setAuthModalStatus(message, type) {
      if (!authModalStatus) return;
      if (!message) {
        authModalStatus.hidden = true;
        authModalStatus.className = 'auth-modal-status';
        if (authStatusText) authStatusText.textContent = '';
        return;
      }
      authModalStatus.hidden = false;
      const statusType = type || 'info';
      authModalStatus.className = 'auth-modal-status status-' + statusType;
      if (authStatusText) authStatusText.textContent = message;
      if (authStatusIcon) {
        if (statusType === 'error') {
          authStatusIcon.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
        } else if (statusType === 'success') {
          authStatusIcon.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
        } else {
          authStatusIcon.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
        }
      }
    }

    function setAuthSubmitLoading(loading, label) {
      if (!authModalSubmit) return;
      authModalSubmit.disabled = loading;
      if (authBtnSpinner) authBtnSpinner.hidden = !loading;
      if (authBtnIcon) authBtnIcon.hidden = loading;
      if (authBtnText) {
        if (loading && label) {
          authBtnText.textContent = label;
        } else if (!loading) {
          authBtnText.textContent = currentAuthMode === 'signup'
            ? 'Create Account'
            : (currentAuthMode === 'reset' ? 'Send Reset Link' : 'Sign In');
        }
      }
    }

    function openAuthModal(mode) {
      initializeAccount();
      currentAuthMode = mode || 'signin';
      if (!authModalOverlay) return;

      setAuthModalStatus('', '');
      setAuthSubmitLoading(false);
      if (authInputPassword) authInputPassword.value = '';
      if (authInputConfirmPassword) authInputConfirmPassword.value = '';

      if (authOfflineBadge) {
        authOfflineBadge.hidden = navigator.onLine;
      }

      const lastEmail = readOfflineCache('account-last-email', '');
      if (lastEmail && authInputEmail && !authInputEmail.value) {
        authInputEmail.value = lastEmail;
      }

      if (currentAuthMode === 'signup') {
        if (authModalTitle) authModalTitle.textContent = 'Create an Account';
        if (authModalSubtitle) authModalSubtitle.textContent = 'Sign up to bookmark places, save custom routes, or dispatch emergency responder units.';
        if (authTablist) authTablist.hidden = false;
        if (authTabSignin) {
          authTabSignin.classList.remove('active');
          authTabSignin.setAttribute('aria-selected', 'false');
        }
        if (authTabSignup) {
          authTabSignup.classList.add('active');
          authTabSignup.setAttribute('aria-selected', 'true');
        }
        if (authFieldNameGroup) authFieldNameGroup.hidden = false;
        if (authFieldRoleGroup) authFieldRoleGroup.hidden = false;
        if (authSigninRoleGroup) authSigninRoleGroup.hidden = true;
        if (authFieldPasswordGroup) authFieldPasswordGroup.hidden = false;
        if (authFieldConfirmPasswordGroup) authFieldConfirmPasswordGroup.hidden = false;
        if (authPasswordHint) authPasswordHint.hidden = false;
        if (authForgotPasswordLink) authForgotPasswordLink.hidden = true;
        if (authFormOptions) authFormOptions.hidden = false;
        if (authBtnText) authBtnText.textContent = 'Create Account';
        if (authFooterToggle) authFooterToggle.hidden = false;
        if (authFooterQuestion) authFooterQuestion.textContent = 'Already have an account?';
        if (authSwitchModeBtn) authSwitchModeBtn.textContent = 'Sign in';
        if (authFooterResetBack) authFooterResetBack.hidden = true;

        setSignupRole(selectedSignupRole || 'personal');

        authModalOverlay.hidden = false;
        authModalOverlay.setAttribute('aria-hidden', 'false');
        setTimeout(function () {
          if (authInputName) authInputName.focus();
        }, 50);
      } else if (currentAuthMode === 'reset') {
        if (authModalTitle) authModalTitle.textContent = 'Reset Password';
        if (authModalSubtitle) authModalSubtitle.textContent = 'Enter your email address and we will send you instructions to reset your password.';
        if (authTablist) authTablist.hidden = true;
        if (authFieldNameGroup) authFieldNameGroup.hidden = true;
        if (authFieldRoleGroup) authFieldRoleGroup.hidden = true;
        if (authSigninRoleGroup) authSigninRoleGroup.hidden = true;
        if (authFieldPasswordGroup) authFieldPasswordGroup.hidden = true;
        if (authFieldConfirmPasswordGroup) authFieldConfirmPasswordGroup.hidden = true;
        if (authPasswordHint) authPasswordHint.hidden = true;
        if (authFormOptions) authFormOptions.hidden = true;
        if (authBtnText) authBtnText.textContent = 'Send Reset Link';
        if (authFooterToggle) authFooterToggle.hidden = true;
        if (authFooterResetBack) authFooterResetBack.hidden = false;

        authModalOverlay.hidden = false;
        authModalOverlay.setAttribute('aria-hidden', 'false');
        setTimeout(function () {
          if (authInputEmail) authInputEmail.focus();
        }, 50);
      } else {
        currentAuthMode = 'signin';
        if (authModalTitle) authModalTitle.textContent = 'Welcome Back';
        if (authModalSubtitle) authModalSubtitle.textContent = 'Sign in to access your saved places, recent routes, or responder console.';
        if (authTablist) authTablist.hidden = false;
        if (authTabSignin) {
          authTabSignin.classList.add('active');
          authTabSignin.setAttribute('aria-selected', 'true');
        }
        if (authTabSignup) {
          authTabSignup.classList.remove('active');
          authTabSignup.setAttribute('aria-selected', 'false');
        }
        if (authFieldNameGroup) authFieldNameGroup.hidden = true;
        if (authFieldRoleGroup) authFieldRoleGroup.hidden = true;
        if (authSigninRoleGroup) authSigninRoleGroup.hidden = false;
        if (authFieldPasswordGroup) authFieldPasswordGroup.hidden = false;
        if (authFieldConfirmPasswordGroup) authFieldConfirmPasswordGroup.hidden = true;
        if (authPasswordHint) authPasswordHint.hidden = true;
        if (authForgotPasswordLink) authForgotPasswordLink.hidden = false;
        if (authFormOptions) authFormOptions.hidden = false;
        if (authBtnText) authBtnText.textContent = 'Sign In';
        if (authFooterToggle) authFooterToggle.hidden = false;
        if (authFooterQuestion) authFooterQuestion.textContent = "Don't have an account?";
        if (authSwitchModeBtn) authSwitchModeBtn.textContent = 'Create one now';
        if (authFooterResetBack) authFooterResetBack.hidden = true;

        const defaultPortal = readOfflineCache('account-last-role', 'personal');
        setPortalMode(selectedPortalMode || defaultPortal);

        authModalOverlay.hidden = false;
        authModalOverlay.setAttribute('aria-hidden', 'false');
        setTimeout(function () {
          if (authInputEmail && !authInputEmail.value) {
            authInputEmail.focus();
          } else if (authInputPassword) {
            authInputPassword.focus();
          }
        }, 50);
      }
    }

    function closeAuthModal() {
      if (!authModalOverlay) return;
      authModalOverlay.hidden = true;
      authModalOverlay.setAttribute('aria-hidden', 'true');
      setAuthModalStatus('', '');
      setAuthSubmitLoading(false);
    }

    window.openAuthModal = openAuthModal;
    window.closeAuthModal = closeAuthModal;

    if (authModalForm) {
      authModalForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        await initializeAccount();
        const email = authInputEmail ? authInputEmail.value.trim() : '';

        if (currentAuthMode === 'reset') {
          if (!email) {
            setAuthModalStatus('Please enter your email address.', 'error');
            if (authInputEmail) authInputEmail.focus();
            return;
          }
          if (!supabaseClient) {
            setAuthModalStatus('Password reset requires an active Supabase connection.', 'error');
            return;
          }
          setAuthSubmitLoading(true, 'Sending link...');
          try {
            const redirectUrl = window.location.origin + window.location.pathname;
            const result = await supabaseClient.auth.resetPasswordForEmail(email, {
              redirectTo: redirectUrl
            });
            if (result.error) throw result.error;
            setAuthModalStatus('Password reset email sent! Check your inbox for instructions.', 'success');
          } catch (error) {
            setAuthModalStatus(error.message || 'Could not send reset link.', 'error');
          } finally {
            setAuthSubmitLoading(false);
          }
          return;
        }

        const password = authInputPassword ? authInputPassword.value : '';

        if (currentAuthMode === 'signup') {
          const displayName = authInputName ? authInputName.value.trim() : '';
          const confirmPassword = authInputConfirmPassword ? authInputConfirmPassword.value : '';
          const targetRole = selectedSignupRole || 'personal';

          if (!displayName) {
            setAuthModalStatus('Please enter your display name.', 'error');
            if (authInputName) authInputName.focus();
            return;
          }
          if (!email) {
            setAuthModalStatus('Please enter your email address.', 'error');
            if (authInputEmail) authInputEmail.focus();
            return;
          }
          if (!password || password.length < 8) {
            setAuthModalStatus('Password must be at least 8 characters long.', 'error');
            if (authInputPassword) authInputPassword.focus();
            return;
          }
          if (password !== confirmPassword) {
            setAuthModalStatus('Passwords do not match. Please re-check.', 'error');
            if (authInputConfirmPassword) authInputConfirmPassword.focus();
            return;
          }

          if (!supabaseClient) {
            setAuthModalStatus('Account creation requires an active Supabase connection.', 'error');
            return;
          }

          setAuthSubmitLoading(true, 'Creating account...');
          try {
            const result = await supabaseClient.auth.signUp({
              email: email,
              password: password,
              options: {
                data: {
                  display_name: displayName,
                  account_role: targetRole
                }
              }
            });
            if (result.error) throw result.error;
            writeOfflineCache('account-last-role', targetRole);
            if (result.data && result.data.user) {
              writeOfflineCache('account-role:' + result.data.user.id, targetRole);
              try {
                await supabaseClient.from('user_profiles').upsert({
                  user_id: result.data.user.id,
                  display_name: displayName,
                  account_role: targetRole,
                  updated_at: new Date().toISOString()
                });
              } catch (profileErr) {
                console.warn('Could not upsert user profile:', profileErr);
              }
            }

            if (result.data && result.data.session) {
              redirectBasedOnRole(targetRole, true);
            } else {
              if (targetRole === 'responder') {
                setAuthModalStatus('Account created! Please check your email to confirm. After confirming, you can sign in to access the Responder Console.', 'success');
              } else {
                setAuthModalStatus('Account created! Please check your email inbox to confirm, then sign in.', 'success');
              }
              setTimeout(function () {
                openAuthModal('signin');
                if (authInputEmail) authInputEmail.value = email;
                setPortalMode(targetRole);
                setAuthModalStatus('Confirmation email sent. Please check your inbox and then sign in.', 'info');
              }, 2500);
            }
          } catch (error) {
            setAuthModalStatus(error.message || 'Could not create account.', 'error');
          } finally {
            setAuthSubmitLoading(false);
          }
          return;
        }

        // Default: Sign In mode
        if (!email) {
          setAuthModalStatus('Please enter your email address.', 'error');
          if (authInputEmail) authInputEmail.focus();
          return;
        }
        if (!password) {
          setAuthModalStatus('Please enter your password.', 'error');
          if (authInputPassword) authInputPassword.focus();
          return;
        }

        setAuthSubmitLoading(true, 'Signing in...');
        try {
          if (!supabaseClient) throw new Error('Account server not connected.');
          const result = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
          });
          if (result.error) throw result.error;
          const signedUser = result.data && result.data.user;
          let detectedRole = (signedUser && signedUser.user_metadata && signedUser.user_metadata.account_role) ||
            readOfflineCache('account-role:' + (signedUser ? signedUser.id : ''), null);
          
          if (!detectedRole) {
            detectedRole = selectedPortalMode || 'personal';
          } else if (selectedPortalMode === 'responder') {
            detectedRole = 'responder';
          }

          writeOfflineCache('account-last-role', detectedRole);
          if (signedUser) {
            writeOfflineCache('account-role:' + signedUser.id, detectedRole);
          }

          redirectBasedOnRole(detectedRole, false);
        } catch (error) {
          if (!navigator.onLine) {
            const cachedSession = readOfflineCache('account-session-last', null);
            if (cachedSession && cachedSession.user &&
              String(cachedSession.user.email || '').toLowerCase() === email.toLowerCase()) {
              const detectedRole = readOfflineCache('account-role:' + cachedSession.user.id, selectedPortalMode || 'personal');
              writeOfflineCache('account-last-role', detectedRole);
              showAccountSession(cachedSession);
              redirectBasedOnRole(detectedRole, false);
            } else {
              setAuthModalStatus('Offline sign-in is available only for an account previously used on this device.', 'error');
            }
          } else {
            setAuthModalStatus(error.message || 'Invalid email or password.', 'error');
          }
        } finally {
          setAuthSubmitLoading(false);
        }
      });
    }

    // Role selector card listeners (Sign Up)
    if (authRoleCardPersonal) {
      authRoleCardPersonal.addEventListener('click', function () { setSignupRole('personal'); });
    }
    if (authRoleCardResponder) {
      authRoleCardResponder.addEventListener('click', function () { setSignupRole('responder'); });
    }
    if (authRolePersonal) {
      authRolePersonal.addEventListener('change', function () { if (this.checked) setSignupRole('personal'); });
    }
    if (authRoleResponder) {
      authRoleResponder.addEventListener('change', function () { if (this.checked) setSignupRole('responder'); });
    }

    // Portal mode buttons (Sign In)
    if (authPortalMap) {
      authPortalMap.addEventListener('click', function () { setPortalMode('personal'); });
    }
    if (authPortalResponder) {
      authPortalResponder.addEventListener('click', function () { setPortalMode('responder'); });
    }

    if (authTabSignin) {
      authTabSignin.addEventListener('click', function () { openAuthModal('signin'); });
    }
    if (authTabSignup) {
      authTabSignup.addEventListener('click', function () { openAuthModal('signup'); });
    }
    if (authSwitchModeBtn) {
      authSwitchModeBtn.addEventListener('click', function () {
        openAuthModal(currentAuthMode === 'signin' ? 'signup' : 'signin');
      });
    }
    if (authForgotPasswordLink) {
      authForgotPasswordLink.addEventListener('click', function () {
        openAuthModal('reset');
      });
    }
    if (authBackToSigninBtn) {
      authBackToSigninBtn.addEventListener('click', function () {
        openAuthModal('signin');
      });
    }
    if (authModalClose) {
      authModalClose.addEventListener('click', closeAuthModal);
    }
    if (authTogglePassword) {
      authTogglePassword.addEventListener('click', function () {
        const isPassword = authInputPassword.getAttribute('type') === 'password';
        const newType = isPassword ? 'text' : 'password';
        authInputPassword.setAttribute('type', newType);
        if (authInputConfirmPassword) {
          authInputConfirmPassword.setAttribute('type', newType);
        }
        const eyeIcon = authTogglePassword.querySelector('.auth-icon-eye');
        const eyeOffIcon = authTogglePassword.querySelector('.auth-icon-eye-off');
        if (eyeIcon && eyeOffIcon) {
          eyeIcon.hidden = isPassword;
          eyeOffIcon.hidden = !isPassword;
        }
        authTogglePassword.setAttribute('title', isPassword ? 'Hide password' : 'Show password');
        authTogglePassword.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
      });
    }
    if (accountOpenSignin) {
      accountOpenSignin.addEventListener('click', function () {
        accountContent.hidden = true;
        accountToggle.setAttribute('aria-expanded', 'false');
        openAuthModal('signin');
      });
    }
    if (accountOpenSignup) {
      accountOpenSignup.addEventListener('click', function () {
        accountContent.hidden = true;
        accountToggle.setAttribute('aria-expanded', 'false');
        openAuthModal('signup');
      });
    }
    if (accountOpenForm) {
      accountOpenForm.addEventListener('click', function () {
        accountContent.hidden = true;
        accountToggle.setAttribute('aria-expanded', 'false');
        openAuthModal('signin');
      });
    }
    if (historyOpenSignin) {
      historyOpenSignin.addEventListener('click', function () {
        historyContent.hidden = true;
        historyToggle.setAttribute('aria-expanded', 'false');
        openAuthModal('signin');
      });
    }
    if (accountViewHistoryBtn) {
      accountViewHistoryBtn.addEventListener('click', function () {
        accountContent.hidden = true;
        accountToggle.setAttribute('aria-expanded', 'false');
        historyContent.hidden = false;
        historyToggle.setAttribute('aria-expanded', 'true');
        if (currentUser) loadActivityHistory(currentUser.id);
      });
    }
    if (accountSwitchBtn) {
      accountSwitchBtn.addEventListener('click', async function () {
        accountContent.hidden = true;
        accountToggle.setAttribute('aria-expanded', 'false');
        if (supabaseClient) {
          try { await supabaseClient.auth.signOut(); } catch (e) {}
        }
        openAuthModal('signin');
      });
    }
    if (accountGoResponder) {
      accountGoResponder.addEventListener('click', function () {
        accountContent.hidden = true;
        if (accountToggle) accountToggle.setAttribute('aria-expanded', 'false');
        window.location.href = getResponderConsoleUrl();
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && authModalOverlay && !authModalOverlay.hidden) {
        closeAuthModal();
      }
    });

    document.getElementById('save-profile').addEventListener('click', async function () {
      if (!supabaseClient || !currentUser) return;
      const displayName = profileNameInput.value.trim();
      const selectedRole = profileRoleSelect ? profileRoleSelect.value : 'personal';
      if (!displayName) {
        setAccountStatus('Enter a display name.');
        return;
      }
      const button = document.getElementById('save-profile');
      button.disabled = true;
      try {
        let result = await supabaseClient
          .from('user_profiles')
          .update({ display_name: displayName, account_role: selectedRole, updated_at: new Date().toISOString() })
          .eq('user_id', currentUser.id);
        if (result.error) {
          result = await supabaseClient
            .from('user_profiles')
            .update({ display_name: displayName, updated_at: new Date().toISOString() })
            .eq('user_id', currentUser.id);
          if (result.error) throw result.error;
        }

        try {
          await supabaseClient.auth.updateUser({
            data: { display_name: displayName, account_role: selectedRole }
          });
        } catch (metaErr) {}

        writeOfflineCache('account-profile:' + currentUser.id, { display_name: displayName, account_role: selectedRole });
        writeOfflineCache('account-role:' + currentUser.id, selectedRole);
        writeOfflineCache('account-last-role', selectedRole);

        const profileNameDisplay = document.getElementById('account-profile-name');
        const avatarBadge = document.getElementById('account-avatar-badge');
        if (profileNameDisplay) profileNameDisplay.textContent = displayName;
        if (avatarBadge) avatarBadge.textContent = displayName[0].toUpperCase();
        updateRoleBadge(selectedRole);

        if (selectedRole === 'responder') {
          setAccountStatus('Profile saved as Emergency Responder. Switching to Responder Console...');
          setTimeout(function () {
            window.location.href = getResponderConsoleUrl();
          }, 850);
        } else {
          setAccountStatus('Profile saved as Personal User.');
        }
      } catch (error) {
        writeOfflineCache('account-profile:' + currentUser.id, { display_name: displayName, account_role: selectedRole });
        writeOfflineCache('account-role:' + currentUser.id, selectedRole);
        writeOfflineCache('account-last-role', selectedRole);
        updateRoleBadge(selectedRole);
        setAccountStatus('Profile saved locally for offline use.');
      } finally {
        button.disabled = false;
      }
    });

    document.getElementById('account-sign-out').addEventListener('click', async function () {
      if (!supabaseClient) return;
      try {
        const result = await supabaseClient.auth.signOut();
        if (result.error) throw result.error;
        setAccountStatus('Signed out.');
      } catch (error) {
        setAccountStatus('Could not sign out: ' + error.message);
      }
    });

    clearHistoryButton.addEventListener('click', async function () {
      if (!supabaseClient || !currentUser) return;
      if (!window.confirm('Clear all saved searches and map activity?')) return;
      clearHistoryButton.disabled = true;
      try {
        const result = await supabaseClient
          .from('map_activity')
          .delete()
          .eq('user_id', currentUser.id);
        if (result.error) throw result.error;
        renderActivityHistory([]);
        setAccountStatus('Saved history cleared.');
      } catch (error) {
        setAccountStatus('Could not clear history: ' + error.message);
      } finally {
        clearHistoryButton.disabled = false;
      }
    });

    const offlineBanner = document.getElementById('offline-banner');
    function updateNetworkStatus() {
      offlineBanner.hidden = navigator.onLine;
      if (!navigator.onLine) {
        setStatus('Offline mode: using previously saved searches, routes, map areas, and account data.');
      } else if (offlineBanner.hidden) {
        offlineBanner.hidden = true;
      }
    }
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    updateNetworkStatus();

    function setStatus(message) {
      status.textContent = message;
      status.classList.toggle('visible', isSidebarExpanded && Boolean(message));
    }

    function markUserInteracted() {
      hasUserInteracted = true;
    }

    function syncEmergencyOpenButtonVisibility() {
      if (!emergencyOpenButton) return;
      const isMobile = window.innerWidth <= 640;
      const mapSearchControls = document.getElementById('map-search-controls');
      const resultsList = document.getElementById('emergency-results-list');
      const isExpanded = (mapSearchControls && mapSearchControls.classList.contains('sidebar-expanded')) ||
        document.body.classList.contains('sidebar-expanded') ||
        document.body.classList.contains('emergency-panel-open') ||
        document.body.classList.contains('chat-open') ||
        (emergencyAssistance && !emergencyAssistance.hidden) ||
        (assistanceChatBox && !assistanceChatBox.hidden) ||
        (serviceDetails && !serviceDetails.hidden) ||
        (resultsList && !resultsList.hidden) ||
        (routesElement && routesElement.children.length > 0);

      if (isMobile && isExpanded) {
        emergencyOpenButton.hidden = true;
        emergencyOpenButton.style.display = 'none';
      } else if (!emergencyAssistance || emergencyAssistance.hidden) {
        if (!assistanceChatBox || assistanceChatBox.hidden) {
          emergencyOpenButton.hidden = false;
          emergencyOpenButton.style.display = '';
        }
      }
    }

    function expandSidebar() {
      isSidebarExpanded = true;
      const mapSearchControls = document.getElementById('map-search-controls');
      if (mapSearchControls) {
        mapSearchControls.classList.add('sidebar-expanded');
      }
      if (emergencyOpenButton) {
        emergencyOpenButton.hidden = true;
      }
      syncEmergencyOpenButtonVisibility();
      status.classList.toggle('visible', Boolean(status.textContent));
      locationStatus.classList.toggle('visible', Boolean(locationStatus.textContent));
    }

    function collapseSidebar(options) {
      document.body.classList.remove('emergency-panel-open');
      isSidebarExpanded = false;
      const keepRoutes = (options && options.keepRoutes === true) || Boolean(currentEmergencyTarget);
      const mapSearchControls = document.getElementById('map-search-controls');
      if (mapSearchControls) {
        mapSearchControls.classList.remove('sidebar-expanded');
      }
      syncEmergencyOpenButtonVisibility();
      isAssistanceSearch = false;
      emergencySearchType = null;
      serviceRequestId += 1;
      if (serviceRequestController) {
        serviceRequestController.abort();
        serviceRequestController = null;
      }
      serviceDetailsRequestId += 1;
      status.classList.remove('visible');
      locationStatus.classList.remove('visible');
      form.hidden = false;
      if (assistanceChatBox && !assistanceChatBox.hidden) {
        emergencyOpenButton.hidden = true;
      } else {
        emergencyOpenButton.hidden = false;
      }
      emergencyOpenButton.setAttribute('aria-expanded', 'false');
      serviceDetails.hidden = true;
      serviceDetails.replaceChildren();
      emergencyAssistance.hidden = true;
      selectedServiceCoordinates = null;

      if (!keepRoutes) {
        searchRequestId += 1;
        isSearching = false;
        if (searchButton) {
          searchButton.disabled = false;
        }
        if (destinationInput) {
          destinationInput.value = '';
          destinationInput.placeholder = 'Search destination or coordinates';
        }
        if (sourceInput) {
          sourceInput.value = '';
          sourceInput.placeholder = 'Your device location';
        }
        status.textContent = '';
        routesElement.replaceChildren();
        routeLayers.clearLayers();
        if (destinationMarker) {
          map.removeLayer(destinationMarker);
          destinationMarker = null;
        }
        if (originMarker) {
          map.removeLayer(originMarker);
          originMarker = null;
        }
      }

      document.querySelectorAll('.service-pin.expanded').forEach(function (expandedPin) {
        expandedPin.classList.remove('expanded');
      });

      // Collapse responder dispatch and emergency facilities results
      const responderBanner = document.getElementById('responder-dispatch-banner');
      if (responderBanner) {
        responderBanner.hidden = true;
        responderBanner.innerHTML = '';
      }
      const emergencyResultsList = document.getElementById('emergency-results-list');
      if (emergencyResultsList) {
        emergencyResultsList.hidden = true;
        emergencyResultsList.replaceChildren();
      }
      const responderSituationSelector = document.getElementById('responder-situation-selector');
      if (responderSituationSelector) {
        responderSituationSelector.hidden = true;
      }
      const emergencyAssistanceResults = document.getElementById('emergency-assistance-results');
      if (emergencyAssistanceResults) {
        emergencyAssistanceResults.hidden = true;
        emergencyAssistanceResults.replaceChildren();
      }
      if (emergencyAssistance) {
        emergencyAssistance.querySelectorAll('[data-emergency-type]').forEach(function (btn) {
          btn.classList.remove('active');
        });
      }
      const incidentBanner = document.getElementById('incident-banner');
      if (incidentBanner) {
        incidentBanner.hidden = true;
      }
      if (typeof isAddingIncident !== 'undefined') {
        isAddingIncident = false;
      }
      if (typeof closeAssistanceChat === 'function') {
        closeAssistanceChat();
      }
    }

    function setLocationStatus(message) {
      locationStatus.textContent = message;
      locationStatus.classList.toggle('visible', isSidebarExpanded);
    }

    function getOpeningStatus(openingHoursValue, coordinates) {
      const schedule = openingHoursValue ? openingHoursValue.trim() : '';
      if (!schedule) {
        return { status: 'Opening hours not provided', state: 'unknown', schedule: '' };
      }
      if (schedule === '24/7') {
        return { status: 'Open 24/7', state: 'open', schedule: schedule };
      }
      if (typeof window.opening_hours !== 'function') {
        return { status: 'Current status unavailable', state: 'unknown', schedule: schedule };
      }

      try {
        const hours = new window.opening_hours(schedule, {
          lat: coordinates[1],
          lon: coordinates[0]
        }, { tag_key: 'opening_hours' });
        if (hours.getUnknown()) {
          return { status: 'Hours status unknown', state: 'unknown', schedule: schedule };
        }

        const isOpen = hours.getState();
        const nextChange = hours.getNextChange();
        if (!nextChange) {
          return {
            status: isOpen ? 'Open 24/7' : 'Closed',
            state: isOpen ? 'open' : 'closed',
            schedule: schedule
          };
        }
        const now = new Date();
        const timeOptions = { hour: 'numeric', minute: '2-digit' };
        if (nextChange.toDateString() !== now.toDateString()) timeOptions.weekday = 'short';
        const nextChangeTime = nextChange.toLocaleTimeString([], timeOptions);
        return {
          status: (isOpen ? 'Open now · Closes ' : 'Closed now · Opens ') + nextChangeTime,
          state: isOpen ? 'open' : 'closed',
          schedule: schedule
        };
      } catch (error) {
        console.warn('Could not interpret opening hours:', schedule, error);
        return { status: 'Hours status unknown', state: 'unknown', schedule: schedule };
      }
    }

    function normalizePhoneNumber(value) {
      if (!value) return '';
      const number = String(value).split(';')[0].replace(/[^\d+*#]/g, '');
      return /\d/.test(number) ? number : '';
    }

    function getSocialDetails(tags) {
      const socialLabels = {
        facebook: 'Facebook',
        instagram: 'Instagram',
        x: 'X / Twitter',
        twitter: 'X / Twitter',
        youtube: 'YouTube',
        tiktok: 'TikTok',
        linkedin: 'LinkedIn',
        telegram: 'Telegram',
        vk: 'VK',
        pinterest: 'Pinterest',
        snapchat: 'Snapchat',
        whatsapp: 'WhatsApp',
        bluesky: 'Bluesky',
        threads: 'Threads',
        mastodon: 'Mastodon',
        reddit: 'Reddit',
        discord: 'Discord',
        flickr: 'Flickr',
        wechat: 'WeChat',
        weibo: 'Weibo',
        qq: 'QQ',
        line: 'LINE',
        signal: 'Signal',
        twitch: 'Twitch',
        github: 'GitHub',
        medium: 'Medium',
        tumblr: 'Tumblr',
        vimeo: 'Vimeo',
        soundcloud: 'SoundCloud',
        skype: 'Skype',
        xing: 'Xing',
        diaspora: 'Diaspora',
        odnoklassniki: 'Odnoklassniki'
      };
      const nonSocialContactFields = new Set([
        'address', 'country_code', 'email', 'fax', 'generic', 'hours', 'language',
        'mobile', 'opening_hours', 'person', 'phone', 'ref', 'sms', 'url', 'website'
      ]);
      const knownPlatforms = new Set(Object.keys(socialLabels));
      const entries = new Map();

      Object.keys(tags).forEach(function (key) {
        const hasContactPrefix = key.toLowerCase().startsWith('contact:');
        const platformKey = (hasContactPrefix ? key.slice(8) : key).toLowerCase();
        const isNonSocialContact = Array.from(nonSocialContactFields).some(function (field) {
          return platformKey === field || platformKey.startsWith(field + ':');
        });
        if (isNonSocialContact || (!hasContactPrefix && !knownPlatforms.has(platformKey))) return;

        const value = String(tags[key] || '').trim();
        if (!value) return;
        const platform = platformKey === 'twitter' ? 'x' : platformKey;
        const priority = (hasContactPrefix ? 2 : 0) + (platformKey === 'x' ? 1 : 0);
        const previous = entries.get(platform);
        if (previous && previous.priority >= priority) return;

        const label = socialLabels[platform] ||
          platform.replace(/[_-]+/g, ' ').replace(/\b\w/g, function (letter) { return letter.toUpperCase(); });
        entries.set(platform, { label: label, value: value, priority: priority });
      });

      return Array.from(entries.entries())
        .sort(function (left, right) { return left[1].label.localeCompare(right[1].label); })
        .map(function (entry) {
          return [entry[1].label, entry[1].value, 'social', entry[0]];
        });
    }

    function getSocialProfileUrl(value, platform) {
      if (!value) return '';
      const rawValue = String(value).trim();
      const urlValue = /^https?:\/\//i.test(rawValue)
        ? rawValue
        : /^[\w.-]+\.[a-z]{2,}(?:\/|$)/i.test(rawValue) ? 'https://' + rawValue : '';
      if (urlValue) {
        try {
          const url = new URL(urlValue);
          return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
        } catch (error) {
          return '';
        }
      }

      if (platform === 'whatsapp') {
        const number = normalizePhoneNumber(rawValue).replace(/[^0-9]/g, '');
        return number ? 'https://wa.me/' + number : '';
      }

      const profileBases = {
        facebook: 'https://www.facebook.com/',
        instagram: 'https://www.instagram.com/',
        x: 'https://x.com/',
        youtube: 'https://www.youtube.com/',
        tiktok: 'https://www.tiktok.com/@',
        linkedin: 'https://www.linkedin.com/in/',
        telegram: 'https://t.me/',
        vk: 'https://vk.com/',
        pinterest: 'https://www.pinterest.com/',
        snapchat: 'https://www.snapchat.com/add/',
        bluesky: 'https://bsky.app/profile/',
        threads: 'https://www.threads.net/@',
        reddit: 'https://www.reddit.com/user/',
        flickr: 'https://www.flickr.com/people/',
        twitch: 'https://www.twitch.tv/',
        github: 'https://github.com/',
        medium: 'https://medium.com/@',
        vimeo: 'https://vimeo.com/',
        soundcloud: 'https://soundcloud.com/',
        weibo: 'https://weibo.com/'
      };
      const handle = rawValue.replace(/^@/, '');
      return profileBases[platform] && handle
        ? profileBases[platform] + encodeURIComponent(handle)
        : '';
    }

    function getDispatchConsoleUrl(facilityName, coords, type) {
      let base = 'responder.html';
      const path = (window.location.pathname || '').toLowerCase();
      if (path === '/' || path === '/map') {
        base = '/dispatch';
      }
      const params = new URLSearchParams();
      if (facilityName) params.set('station', facilityName);
      if (coords && coords.length >= 2) {
        params.set('stationLng', coords[0]);
        params.set('stationLat', coords[1]);
      }
      if (type) params.set('type', type);
      const userLoc = (typeof getDetectedUserLocation === 'function') ? getDetectedUserLocation() : null;
      if (userLoc && userLoc.coords) {
        params.set('lng', userLoc.coords[0]);
        params.set('lat', userLoc.coords[1]);
        if (userLoc.districtName) params.set('district', userLoc.districtName);
      }
      const qs = params.toString();
      return qs ? (base + '?' + qs) : base;
    }

    function showServiceDetails(name, categoryLabel, details, color, notice, actions) {
      serviceDetails.replaceChildren();
      serviceDetails.style.setProperty('--service-color', color);

      const heading = document.createElement('div');
      heading.className = 'service-details-heading';
      const title = document.createElement('strong');
      title.className = 'service-details-title';
      title.textContent = name;
      heading.appendChild(title);
      serviceDetails.appendChild(heading);

      const category = document.createElement('div');
      category.className = 'service-details-category';
      category.textContent = categoryLabel;
      serviceDetails.appendChild(category);

      const actionBar = document.createElement('div');
      actionBar.className = 'service-details-actions';
      const addAction = function (label, href, onClick, className) {
        const action = href ? document.createElement('a') : document.createElement('button');
        action.className = 'service-details-action' + (className ? ' ' + className : '');
        action.textContent = label;
        if (href) {
          action.href = href;
        } else {
          action.type = 'button';
          action.addEventListener('click', onClick);
        }
        actionBar.appendChild(action);
        return action;
      };
      const addContactAction = function (label, scheme, number) {
        if (number) {
          return addAction(label, scheme + number);
        }
        const action = document.createElement('button');
        action.type = 'button';
        action.className = 'service-details-action';
        action.textContent = label;
        action.disabled = true;
        action.title = 'No phone number is available for this place.';
        actionBar.appendChild(action);
        return action;
      };
      addContactAction('Call', 'tel:', actions && actions.callNumber);
      addContactAction('Message', 'sms:', actions && actions.messageNumber);

      if (selectedServiceCoordinates) {
        const routeAction = addAction('Active Route', '', function () {
          if (window.innerWidth <= 640) {
            document.body.classList.add('mobile-route-active');
            collapseSidebar();
            if (serviceDetails) {
              serviceDetails.hidden = true;
            }
          }
          if (emergencyAssistance) {
            emergencyAssistance.hidden = true;
            document.body.classList.remove('emergency-panel-open');
          }
          if (emergencyOpenButton) {
            emergencyOpenButton.setAttribute('aria-expanded', 'false');
            syncEmergencyOpenButtonVisibility();
          }

          let distKm = '';
          let estMins = 5;
          if (currentLocationCoords && selectedServiceCoordinates) {
            const d = computeDistanceInMeters(
              currentLocationCoords.lat,
              currentLocationCoords.lng,
              selectedServiceCoordinates[1],
              selectedServiceCoordinates[0]
            );
            distKm = d >= 1000 ? (d / 1000).toFixed(1) : (d / 1000).toFixed(2);
            estMins = Math.max(1, Math.round(d / 500));
          }

          searchDestination(name, selectedServiceCoordinates, { emergencyType: actionType || 'emergency' });

          showEmergencyRouteConfirmationBar({
            name: name,
            category: categoryLabel,
            distKm: distKm,
            durationMins: estMins,
            coordinates: selectedServiceCoordinates,
            phone: actions && (actions.callNumber || actions.phone),
            type: actionType || 'emergency'
          }, false);

          setStatus('🧭 Route Preview: Routing to ' + name + (estMins ? ' (~' + estMins + ' min).' : '.'));

          setTimeout(function () {
            if (typeof map !== 'undefined' && map && typeof map.invalidateSize === 'function') {
              map.invalidateSize();
              if (typeof routeLayers !== 'undefined' && routeLayers.getBounds && routeLayers.getBounds().isValid()) {
                fitMapBoundsSafely(routeLayers.getBounds(), true);
              }
            }
          }, 150);
        }, 'route-btn');
        if (routeAction) {
          routeAction.title = 'Active Route to ' + name;
          routeAction.setAttribute('aria-label', 'Active Route to ' + name);
        }
      }

      let actionType = (actions && actions.type) || emergencySearchType || null;
      if (!actionType) {
        const textToMatch = ((name || '') + ' ' + (categoryLabel || '')).toLowerCase();
        if (/police|pnp|precinct|patrol|law enforcement/i.test(textToMatch)) {
          actionType = 'police';
        } else if (/fire|bfp|fireman|firefighter|firehouse|fire truck|fire engine|fire station/i.test(textToMatch)) {
          actionType = 'fire';
        } else if (/rescue|responder|drrmo|disaster|coast guard|mddrmo|pdrrmo|cdrrmo/i.test(textToMatch)) {
          actionType = 'responder';
        } else if (/ambulance|hospital|medical center|clinic|doctor|medic|infirmary/i.test(textToMatch)) {
          actionType = 'ambulance';
        }
      }

      const needAssistanceHandler = (actions && actions.onNeedAssistance) || function () {
        openAssistanceChat({
          name: name,
          category: categoryLabel,
          phone: actions && (actions.callNumber || actions.phone),
          coordinates: selectedServiceCoordinates,
          type: actionType
        });
      };
      const assistanceBtn = addAction('Need Assistance', '', needAssistanceHandler, 'assistance');
      if (assistanceBtn) {
        assistanceBtn.title = 'Need Assistance';
        assistanceBtn.setAttribute('aria-label', 'Need Assistance');
      }
      serviceDetails.appendChild(actionBar);

      details.forEach(function (detail) {
        if (!detail[1]) return;
        const row = document.createElement('div');
        row.className = 'service-details-row';
        const label = document.createElement('strong');
        label.textContent = detail[0] + ': ';
        row.appendChild(label);

        if (detail[2] === 'status') {
          label.classList.add('service-details-hours', detail[3]);
          const value = document.createElement('span');
          value.className = 'service-details-hours ' + detail[3];
          value.textContent = detail[1];
          row.appendChild(value);
        } else if (detail[2] === 'phone' || detail[2] === 'email' ||
          detail[2] === 'website' || detail[2] === 'social') {
          const link = document.createElement('a');
          link.textContent = detail[1];
          if (detail[2] === 'phone') {
            link.href = 'tel:' + detail[1].replace(/[^\d+*#;]/g, '');
          } else if (detail[2] === 'email') {
            link.href = 'mailto:' + encodeURIComponent(detail[1]);
          } else {
            try {
              const socialUrl = detail[2] === 'social'
                ? getSocialProfileUrl(detail[1], detail[3])
                : /^https?:\/\//i.test(detail[1]) ? detail[1] : 'https://' + detail[1];
              if (!socialUrl) throw new Error('No safe social profile URL could be created.');
              const website = new URL(socialUrl);
              if (website.protocol !== 'http:' && website.protocol !== 'https:') throw new Error('Unsupported website protocol.');
              link.href = website.href;
              link.target = '_blank';
              link.rel = 'noopener noreferrer';
            } catch (error) {
              row.appendChild(document.createTextNode(detail[1]));
              serviceDetails.appendChild(row);
              return;
            }
          }
          row.appendChild(link);
        } else {
          row.appendChild(document.createTextNode(detail[1]));
        }
        serviceDetails.appendChild(row);
      });

      if (notice) {
        const noticeRow = document.createElement('div');
        noticeRow.className = 'service-details-notice';
        noticeRow.textContent = notice;
        serviceDetails.appendChild(noticeRow);
      }
      serviceDetails.hidden = false;
      if (emergencyOpenButton) {
        emergencyOpenButton.hidden = true;
      }
    }

    async function loadOpenStreetMapDetails(
      objectType, objectId, tags, name, categoryLabel, getDetails, getActions, color, requestId
    ) {
      const controller = new AbortController();
      const timeoutId = setTimeout(function () { controller.abort(); }, 12000);
      try {
        const response = await fetch(
          'https://api.openstreetmap.org/api/0.6/' + objectType + '/' + encodeURIComponent(objectId) + '.json',
          { signal: controller.signal }
        );
        if (!response.ok) throw new Error('OpenStreetMap returned HTTP ' + response.status + '.');
        const data = await response.json();
        const element = Array.isArray(data.elements) && data.elements.find(function (item) {
          return item.type === objectType && String(item.id) === String(objectId);
        });
        if (!element || !element.tags) throw new Error('No detailed tags were found for this map feature.');
        Object.assign(tags, element.tags);
        if (requestId !== serviceDetailsRequestId || !isSidebarExpanded) return;
        showServiceDetails(name, categoryLabel, getDetails(), color, '', getActions());
      } catch (error) {
        if (requestId !== serviceDetailsRequestId || !isSidebarExpanded) return;
        console.warn('Could not load additional OpenStreetMap details:', error);
        showServiceDetails(
          name,
          categoryLabel,
          getDetails(),
          color,
          'Could not load additional OpenStreetMap data. Showing available details.',
          getActions()
        );
      } finally {
        clearTimeout(timeoutId);
      }
    }

    map.on('locationfound', function (event) {
      applyDetectedLocation([event.latlng.lng, event.latlng.lat], event.accuracy, 'GPS Location', {
        setView: false,
        autoSearch: false
      });
    });

    map.on('locationerror', function (event) {
      console.warn('Leaflet locate event error:', event.message);
      if (!userDeviceCoords) {
        requestDeviceLocation({ setView: false, userInitiated: false, autoSearch: false });
      }
    });

    map.on('dragstart', markUserInteracted);
    map.on('zoomstart', function (event) {
      if (event.originalEvent) markUserInteracted();
    });

    function parseCoordinates(value) {
      const match = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
      if (!match) return null;
      const lat = Number(match[1]);
      const lon = Number(match[2]);
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        throw new Error('Coordinates must be valid latitude, longitude values.');
      }
      return [lon, lat];
    }

    async function findLocation(value) {
      const coordinates = parseCoordinates(value);
      if (coordinates) return coordinates;

      // Check if user is searching for a doctor specialization (e.g. "pedia", "ent", "cardio", "cardiologist", "nearest pedia")
      const specialtySearch = typeof matchDoctorSpecializationQuery === 'function' ? matchDoctorSpecializationQuery(value) : null;
      if (specialtySearch && typeof findFastestSpecializationService === 'function') {
        const userLoc = typeof getDetectedUserLocation === 'function' ? getDetectedUserLocation() : null;
        const originCoords = (userLoc && userLoc.coords) || (typeof routeOrigin !== 'undefined' && routeOrigin) || [122.5368, 10.7196];
        const originPoint = L.latLng(originCoords[1], originCoords[0]);
        const sorted = queryNearestFacilitiesByDoctorSpecialization(specialtySearch.id, originPoint);
        if (sorted && sorted.length > 0) {
          findFastestSpecializationService(specialtySearch.id);
          return sorted[0].coordinates;
        }
      }

      // Check if user is searching for a service category (e.g. "nearest mental health facility", "clinic", "pharmacy")
      const catSearch = typeof matchServiceCategoryQuery === 'function' ? matchServiceCategoryQuery(value) : null;
      if (catSearch && typeof findFastestCategoryService === 'function') {
        const userLoc = typeof getDetectedUserLocation === 'function' ? getDetectedUserLocation() : null;
        const originCoords = (userLoc && userLoc.coords) || (typeof routeOrigin !== 'undefined' && routeOrigin) || [122.5368, 10.7196];
        const originPoint = L.latLng(originCoords[1], originCoords[0]);
        const sorted = queryNearestFacilitiesByServiceCategory(catSearch.id, originPoint);
        if (sorted && sorted.length > 0) {
          findFastestCategoryService(catSearch.id);
          return sorted[0].coordinates;
        }
      }
      const cacheKey = 'search:' + value.trim().toLowerCase();
      try {
        const response = await fetch('https://photon.komoot.io/api/?limit=1&q=' + encodeURIComponent(value));
        if (!response.ok) throw new Error('Location search failed. Please try again.');
        const data = await response.json();
        const feature = data.features && data.features[0];
        if (!feature) throw new Error('Could not find "' + value + '". Try a more specific location.');
        writeOfflineCache(cacheKey, feature.geometry.coordinates);
        writeOfflineCache('search-data:' + cacheKey, data);
        return feature.geometry.coordinates;
      } catch (error) {
        const cached = readOfflineCache(cacheKey, null);
        if (cached) {
          setStatus('Showing a previously saved offline search result.');
          return cached;
        }
        // Check local emergency facilities directory for offline search
        const lowerVal = value.trim().toLowerCase();
        const matchedFacility = KNOWN_EMERGENCY_FACILITIES.find(function (f) {
          return f.name.toLowerCase().includes(lowerVal) || lowerVal.includes(f.name.toLowerCase()) ||
                 (f.address && f.address.toLowerCase().includes(lowerVal));
        });
        if (matchedFacility) {
          setStatus('Offline Mode: Found ' + matchedFacility.name + ' in offline database.');
          return matchedFacility.coordinates;
        }
        throw error;
      }
    }

    function formatDistance(meters) {
      return meters < 1000 ? Math.round(meters) + ' m' : (meters / 1000).toFixed(1) + ' km';
    }

    function formatDuration(seconds) {
      const minutes = Math.round(seconds / 60);
      if (minutes < 60) return minutes + ' min';
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return remainingMinutes ? hours + ' hr ' + remainingMinutes + ' min' : hours + ' hr';
    }

    function formatInstruction(step) {
      if (step.instruction) return step.instruction;
      const maneuver = step.maneuver || {};
      const modifier = maneuver.modifier ? maneuver.modifier.replace(/_/g, ' ') : '';
      const roadName = step.name || step.ref;
      const road = roadName ? ' onto ' + roadName : '';
      const direction = modifier ? ' ' + modifier : '';

      switch (maneuver.type) {
        case 'depart':
          return 'Start' + (roadName ? ' on ' + roadName : '');
        case 'arrive':
          return 'Arrive at your destination';
        case 'turn':
          return 'Turn' + (direction || ' ahead') + road;
        case 'continue':
          return 'Continue' + (direction || ' straight') + road;
        case 'new name':
          return 'Continue' + road;
        case 'fork':
          return 'At the fork, keep' + (direction || ' straight') + road;
        case 'merge':
          return 'Merge' + direction + road;
        case 'on ramp':
          return 'Take the ramp' + direction + road;
        case 'off ramp':
          return 'Take the exit' + direction + road;
        case 'end of road':
          return 'At the end of the road, turn' + (direction || ' ahead') + road;
        case 'roundabout':
        case 'rotary':
          return 'At the roundabout, take exit ' + (maneuver.exit || 'as indicated') + road;
        case 'exit roundabout':
          return 'Exit the roundabout' + road;
        case 'notification':
          return roadName ? 'Continue on ' + roadName : 'Continue';
        default:
          return (maneuver.type || 'Continue').replace(/_/g, ' ') + direction + road;
      }
    }

    function addRouteCard(route, index, layer, usesLiveTraffic, routeContext) {
      const isFastest = (index === 0);
      const card = document.createElement('details');
      card.className = 'route-card' + (isFastest ? ' fastest selected' : '');

      const summary = document.createElement('summary');
      const title = document.createElement('span');
      title.className = 'route-name';

      if (route.algorithmStats) {
        title.textContent = route.algorithmStats.algorithm + ' route';
      } else if (isFastest) {
        title.textContent = route.isDetourBypass
          ? 'Fastest route (hazard bypass)'
          : (route.totalDelaySeconds > 60
            ? 'Fastest route (live conditions evaluated)'
            : 'Fastest route');
      } else {
        title.textContent = 'Alternative route ' + (index + 1);
      }

      const metadata = document.createElement('span');
      metadata.className = 'route-meta';
      metadata.textContent = formatDistance(route.distance) + ' · ' + formatDuration(route.duration);
      if (isFastest && route.totalDelaySeconds && route.totalDelaySeconds > 60) {
        const delayBadge = document.createElement('span');
        delayBadge.className = 'delay-badge';
        delayBadge.textContent = '+' + formatDuration(route.totalDelaySeconds) + ' delay';
        metadata.appendChild(document.createTextNode(' '));
        metadata.appendChild(delayBadge);
      }
      summary.append(title, metadata);
      card.appendChild(summary);

      if (route.algorithmStats) {
        const stats = route.algorithmStats;
        const statsLine = document.createElement('p');
        statsLine.className = 'algorithm-route-stats';
        statsLine.textContent = 'Execution ' + (stats.execution_time_seconds * 1000).toFixed(2) + ' ms · ' +
          'peak memory ' + (stats.peak_traced_memory_bytes / 1024).toFixed(1) + ' KiB · ' +
          stats.unique_explored_nodes + ' explored nodes · ' + stats.nodes_processed + ' processed · ' +
          stats.edge_checks + ' edge checks · ' + stats.successful_relaxations + ' relaxations' +
          (stats.iterations == null ? '' : ' · ' + stats.iterations + ' passes') +
          (stats.graph ? ' · graph ' + stats.graph.node_count + ' nodes / ' + stats.graph.edge_count + ' edges' : '');
        card.appendChild(statsLine);
      }

      // Collect route step maneuvers
      const steps = [];
      (route.legs || []).forEach(function (leg) {
        (leg.steps || []).forEach(function (step) { steps.push(step); });
      });

      // Turn maneuvers count and penalty
      const turnSteps = steps.filter(function (s) {
        if (!s) return false;
        if (s.maneuver && (s.maneuver.type === 'depart' || s.maneuver.type === 'arrive')) return false;
        const inst = (s.instruction || '').toLowerCase();
        return inst.includes('turn') || inst.includes('keep') || inst.includes('roundabout') || inst.includes('fork') || inst.includes('continue');
      });
      const turnCount = Math.max(1, turnSteps.length || (steps.length > 1 ? steps.length - 1 : 1));
      const turnDelaySec = Math.round(turnCount * 15);

      // Travel time values
      const baseSec = route.baseDuration || route.duration;
      const trafficSec = route.trafficDelaySeconds || 0;
      const eventSec = route.eventDelaySeconds || 0;
      const totalSec = route.duration;
      const delaySec = route.totalDelaySeconds || 0;

      // Extract context details
      const ctx = (typeof routeContext === 'object' && routeContext !== null) ? routeContext : {};
      let facilityInfo = ctx.facility || null;
      const destinationText = (ctx.destination || destinationInput.value || '').trim();

      if (!facilityInfo && destinationText) {
        const lowerDest = destinationText.toLowerCase();
        facilityInfo = KNOWN_EMERGENCY_FACILITIES.find(function (f) {
          if (ctx.endCoordinates && f.coordinates) {
            const d = L.latLng(ctx.endCoordinates[1], ctx.endCoordinates[0]).distanceTo(L.latLng(f.coordinates[1], f.coordinates[0]));
            if (d < 250) return true;
          }
          const lowerF = f.name.toLowerCase();
          return lowerDest.includes(lowerF) || lowerF.includes(lowerDest);
        });

        if (!facilityInfo) {
          const isFacilityName = /hospital|clinic|station|bfp|pnp|drrmo|health|medical|police|fire|rescue|infirmary|sanitarium|emergency|center/i.test(lowerDest);
          if (isFacilityName || ctx.emergencyType) {
            const infType = ctx.emergencyType || (
              /police|pnp/i.test(lowerDest) ? 'police' :
              /fire|bfp/i.test(lowerDest) ? 'fire' :
              /rescue|drrmo|disaster/i.test(lowerDest) ? 'responder' : 'ambulance'
            );
            facilityInfo = {
              name: destinationText,
              type: infType,
              category: infType === 'police' ? 'Law Enforcement Precinct / Station' :
                infType === 'fire' ? 'Fire & Rescue Station (BFP)' :
                infType === 'responder' ? 'Disaster Risk Reduction & Rescue Unit' : 'Medical & Emergency Care Facility',
              address: ctx.endCoordinates ? (ctx.endCoordinates[1].toFixed(4) + '°N, ' + ctx.endCoordinates[0].toFixed(4) + '°E, Iloilo') : 'Verified Emergency Facility Zone',
              phone: infType === 'police' ? '(033) 335-0299' :
                infType === 'fire' ? '(033) 337-3011' :
                infType === 'responder' ? '(033) 333-1111' : '(033) 321-2841',
              coordinates: ctx.endCoordinates || null
            };
          }
        }
      }

      // ONLY for fastest route: render Facility Details, Travel Time Factors, and Path Selection Factors
      if (isFastest && !route.algorithmStats) {
        // 1. Destination Facility Profile & Information
        if (facilityInfo) {
          const facilityCard = document.createElement('div');
          facilityCard.className = 'facility-profile-card';

          const fType = facilityInfo.type || 'ambulance';
          const typeIcons = {
            ambulance: '🏥',
            police: '🚓',
            fire: '🚒',
            responder: '🛟'
          };
          const iconSymbol = typeIcons[fType] || '🏥';

          const fHeader = document.createElement('div');
          fHeader.className = 'facility-profile-header';

          const iconBadge = document.createElement('div');
          iconBadge.className = 'facility-icon-badge ' + fType;
          iconBadge.textContent = iconSymbol;

          const titleGroup = document.createElement('div');
          titleGroup.className = 'facility-title-group';

          const nameEl = document.createElement('div');
          nameEl.className = 'facility-profile-name';
          nameEl.textContent = facilityInfo.name;

          const catEl = document.createElement('div');
          catEl.className = 'facility-profile-category';
          catEl.textContent = facilityInfo.category || 'Emergency Response Facility';

          titleGroup.append(nameEl, catEl);

          const statusPill = document.createElement('div');
          statusPill.className = 'facility-status-pill';
          statusPill.innerHTML = '<span class="status-dot-pulse"></span> Open 24/7';

          fHeader.append(iconBadge, titleGroup, statusPill);
          facilityCard.appendChild(fHeader);

          const detailsList = document.createElement('div');
          detailsList.className = 'facility-details-list';

          if (facilityInfo.address) {
            const addrRow = document.createElement('div');
            addrRow.className = 'facility-detail-row';
            addrRow.innerHTML = '<span class="detail-icon">📍</span><span class="detail-text"><strong>Physical Address:</strong> ' + escapeHtml(facilityInfo.address) + '</span>';
            detailsList.appendChild(addrRow);
          }

          const ingressRow = document.createElement('div');
          ingressRow.className = 'facility-detail-row';
          ingressRow.innerHTML = '<span class="detail-icon">🚑</span><span class="detail-text"><strong>Ingress Clearance:</strong> Priority Emergency Bay & Rapid Triage Entry</span>';
          detailsList.appendChild(ingressRow);

          const readinessRow = document.createElement('div');
          readinessRow.className = 'facility-detail-row';
          readinessRow.innerHTML = '<span class="detail-icon">📡</span><span class="detail-text"><strong>Coordination:</strong> Active Duty Emergency Unit on Standby · Radio/Dispatch Linked</span>';
          detailsList.appendChild(readinessRow);

          facilityCard.appendChild(detailsList);

          if (facilityInfo.phone) {
            const actionRow = document.createElement('div');
            actionRow.className = 'facility-hotline-action';
            const cleanPhone = facilityInfo.phone.replace(/[^\d+*#;]/g, '');
            actionRow.innerHTML = '<a href="tel:' + cleanPhone + '" class="facility-call-btn">📞 24/7 Hotline: ' + escapeHtml(facilityInfo.phone) + '</a>';
            facilityCard.appendChild(actionRow);
          }

          card.appendChild(facilityCard);
        }

        // 2. Conditions Affecting Overall Travel Time
        const timeFactorsBlock = document.createElement('div');
        timeFactorsBlock.className = 'factors-block travel-time-factors';

        const timeHeader = document.createElement('div');
        timeHeader.className = 'factors-header';
        timeHeader.innerHTML = '<span class="factors-title">⏱️ Conditions Affecting Overall Travel Time</span><span class="factors-pill-tag">Live Conditions</span>';
        timeFactorsBlock.appendChild(timeHeader);

        // 2-Tile summary grid: Travel Time and Distance only
        const grid = document.createElement('div');
        grid.className = 'breakdown-grid';
        grid.style.gridTemplateColumns = 'repeat(2, 1fr)';

        const addTile = function (label, value, className) {
          const tile = document.createElement('div');
          tile.className = 'breakdown-tile' + (className ? ' ' + className : '');
          const lbl = document.createElement('span');
          lbl.className = 'breakdown-label';
          lbl.textContent = label;
          const val = document.createElement('span');
          val.className = 'breakdown-value';
          val.textContent = value;
          tile.append(lbl, val);
          grid.appendChild(tile);
        };

        addTile('Travel Time', formatDuration(totalSec), 'total');
        addTile('Distance', formatDistance(route.distance || 0));
        timeFactorsBlock.appendChild(grid);

        // Itemized list of conditions that can affect overall travel time
        const factorList = document.createElement('ul');
        factorList.className = 'factor-item-list';

        // Factor A: Live Traffic Congestion
        const trafficItem = document.createElement('li');
        if (route.trafficDelays && route.trafficDelays.length > 0) {
          trafficItem.className = 'factor-item-card delayed';
          const delayDescriptions = route.trafficDelays.map(function (t) {
            return t.road + ' (' + t.multiplier.toFixed(1) + 'x slowdown adds +' + formatDuration(t.extraSec) + ')';
          }).join(', ');
          trafficItem.innerHTML = '<span class="factor-icon">🚗</span><div class="factor-content"><div class="factor-label">Live Traffic Congestion Delays (+' + formatDuration(trafficSec) + ')</div><div class="factor-desc">Bottlenecks detected on: ' + escapeHtml(delayDescriptions) + '.</div></div>';
        } else {
          trafficItem.className = 'factor-item-card safe';
          trafficItem.innerHTML = '<span class="factor-icon">🚗</span><div class="factor-content"><div class="factor-label">Free-Flow Traffic Conditions (0 min delay)</div><div class="factor-desc">Corridor roads operating at legal speed limits without significant vehicular queueing.</div></div>';
        }
        factorList.appendChild(trafficItem);

        // Factor B: Spatial Hazard Buffers & Weather
        const hazardItem = document.createElement('li');
        if (route.incidentCollisions && route.incidentCollisions.length > 0) {
          hazardItem.className = 'factor-item-card delayed';
          const incDescriptions = route.incidentCollisions.map(function (inc) {
            return inc.name + ' (' + (inc.impassable ? 'closure bypass required' : '+' + formatDuration(inc.penaltySeconds) + ' caution speed slowdown') + ')';
          }).join(', ');
          hazardItem.innerHTML = '<span class="factor-icon">⚠️</span><div class="factor-content"><div class="factor-label">Corridor Hazards & Caution Buffers (+' + formatDuration(eventSec) + ')</div><div class="factor-desc">' + escapeHtml(incDescriptions) + '.</div></div>';
        } else if (route.isDetourBypass) {
          hazardItem.className = 'factor-item-card safe';
          hazardItem.innerHTML = '<span class="factor-icon">🛡️</span><div class="factor-content"><div class="factor-label">Safe Incident Detour Applied</div><div class="factor-desc">Corridor was dynamically recalculated around ' + escapeHtml(route.bypassedIncident || 'road closure') + ' to ensure unhindered passage.</div></div>';
        } else {
          hazardItem.className = 'factor-item-card safe';
          hazardItem.innerHTML = '<span class="factor-icon">✅</span><div class="factor-content"><div class="factor-label">Hazard-Clear Emergency Corridor</div><div class="factor-desc">Zero active flood zones, road works, or barricades along this pathway.</div></div>';
        }
        factorList.appendChild(hazardItem);

        // Factor C: Intersection Maneuvers & Signals
        const turnsItem = document.createElement('li');
        turnsItem.className = 'factor-item-card';
        turnsItem.innerHTML = '<span class="factor-icon">🚦</span><div class="factor-content"><div class="factor-label">Intersection Maneuvers & Signals (~' + formatDuration(turnDelaySec) + ')</div><div class="factor-desc">' + turnCount + ' turning maneuvers, merges, and signalized crossings requiring deceleration and right-of-way yields (~15 sec each).</div></div>';
        factorList.appendChild(turnsItem);

        // Factor D: Road Pavement Surface Friction
        const surfaceItem = document.createElement('li');
        surfaceItem.className = 'factor-item-card';
        surfaceItem.innerHTML = '<span class="factor-icon">🛣️</span><div class="factor-content"><div class="factor-label">Pavement Friction & Road Grip</div><div class="factor-desc">Standard asphalt pavement friction coefficient (μ ≈ 0.82) under nominal dry conditions with standard vehicle deceleration profiles.</div></div>';
        factorList.appendChild(surfaceItem);

        timeFactorsBlock.appendChild(factorList);
        card.appendChild(timeFactorsBlock);
      }

      // Step-by-step turn directions with factor badges
      const directions = document.createElement('div');
      directions.className = 'route-directions';

      if (steps.length) {
        const list = document.createElement('ol');
        steps.forEach(function (step, sIdx) {
          const item = document.createElement('li');
          const instruction = document.createElement('span');
          instruction.textContent = formatInstruction(step);

          if (step.trafficCongestion) {
            const trafficTag = document.createElement('span');
            trafficTag.className = 'hazard-step-tag traffic';
            trafficTag.textContent = '🚗 ' + step.trafficCongestion.toFixed(1) + 'x traffic';
            instruction.appendChild(trafficTag);
          }
          if (step.incidentTag) {
            const incTag = document.createElement('span');
            incTag.className = 'hazard-step-tag event';
            incTag.textContent = step.incidentTag;
            instruction.appendChild(incTag);
          }
          if (sIdx === steps.length - 1 && isFastest && facilityInfo) {
            const arrivalTag = document.createElement('span');
            arrivalTag.className = 'hazard-step-tag arrival';
            arrivalTag.textContent = '🏁 Facility Emergency Bay Arrival';
            instruction.appendChild(arrivalTag);
          }

          const distance = document.createElement('span');
          distance.className = 'step-distance';
          distance.textContent = formatDistance(step.distance);
          item.append(instruction, distance);
          list.appendChild(item);
        });
        directions.appendChild(list);
      } else {
        const message = document.createElement('p');
        message.className = 'no-directions';
        message.textContent = 'Turn-by-turn directions are unavailable for this route.';
        directions.appendChild(message);
      }
      card.appendChild(directions);

      if (isFastest) {
        card.open = true;
      }

      summary.addEventListener('click', function () {
        routesElement.querySelectorAll('.route-card').forEach(function (otherCard) {
          otherCard.classList.remove('selected');
        });
        card.classList.add('selected');
        if (layer && typeof layer.bringToFront === 'function') {
          layer.bringToFront();
        }
      });
      routesElement.appendChild(card);
    }

    async function findEsriRoute(start, end) {
      const request = new URLSearchParams({
        f: 'json',
        token: esriTrafficApiKey,
        stops: start.join(',') + ';' + end.join(','),
        impedanceAttributeName: 'TravelTime',
        accumulateAttributeNames: 'Kilometers',
        startTime: 'now',
        returnDirections: 'true',
        directionsTimeAttributeName: 'TravelTime',
        directionsLengthUnits: 'esriNAUKilometers',
        returnRoutes: 'true',
        outputLines: 'esriNAOutputLineTrueShape',
        outSR: '4326'
      });
      const response = await fetch(
        'https://route-api.arcgis.com/arcgis/rest/services/World/Route/NAServer/Route_World/solve',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: request.toString()
        }
      );
      if (!response.ok) throw new Error('Traffic-aware route service is unavailable. Please try again.');
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error.message || 'Traffic-aware route service returned an error.');
      }

      const feature = data.routes && data.routes.features && data.routes.features[0];
      const geometry = feature && feature.geometry;
      const path = geometry && geometry.paths && geometry.paths[0];
      if (!feature || !path || path.length === 0) {
        throw new Error('No traffic-aware driving route was found for those locations.');
      }

      const attributes = feature.attributes || {};
      const distanceKilometers = Number(attributes.Total_Kilometers);
      const durationMinutes = Number(attributes.Total_TravelTime);
      if (!Number.isFinite(distanceKilometers) || !Number.isFinite(durationMinutes)) {
        throw new Error('Traffic-aware route service returned incomplete route details.');
      }

      const directionFeatures = data.directions && data.directions[0] &&
        data.directions[0].features || [];
      const routes = [{
        distance: distanceKilometers * 1000,
        duration: durationMinutes * 60,
        geometry: {
          type: 'LineString',
          coordinates: path.map(function (coordinate) {
            return [coordinate[0], coordinate[1]];
          })
        },
        legs: [{
          steps: directionFeatures.map(function (direction) {
            const directionAttributes = direction.attributes || {};
            return {
              distance: Number(directionAttributes.length || 0) * 1000,
              instruction: directionAttributes.text || 'Continue along the route'
            };
          })
        }]
      }];
      writeOfflineCache('route:esri:' + start.join(',') + ':' + end.join(','), routes);
      return routes;
    }

    async function findStandardRoutes(start, end) {
      const coordinates = [start, end].map(function (point) { return point.join(','); }).join(';');
      const routeKey = 'route:standard:' + start.join(',') + ':' + end.join(',');
      try {
        const response = await fetch(
          'https://router.project-osrm.org/route/v1/driving/' + coordinates +
          '?alternatives=3&steps=true&overview=full&geometries=geojson'
        );
        if (!response.ok) throw new Error('Route service is unavailable. Please try again.');
        const data = await response.json();
        if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
          throw new Error('No driving routes were found for those locations.');
        }
        const routes = data.routes.slice().sort(function (a, b) {
          const durationDifference = a.duration - b.duration;
          return durationDifference !== 0 ? durationDifference : a.distance - b.distance;
        });
        writeOfflineCache(routeKey, routes);
        return routes;
      } catch (error) {
        const cached = readOfflineCache(routeKey, null);
        if (cached) return cached;
        throw error;
      }
    }

    async function findAlgorithmRoutes(start, end, algorithm) {
      const response = await fetch('/api/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin_lat: start[1],
          origin_lon: start[0],
          destination_lat: end[1],
          destination_lon: end[0],
          algorithm: algorithm
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Algorithm routing is unavailable.');
      const results = data.algorithm === 'all' ? data.results : [data];
      const routes = results.filter(function (result) {
        return Array.isArray(result.route_coordinates) && result.route_coordinates.length > 0;
      }).map(function (result) {
        return {
          distance: result.route_distance_meters || 0,
          duration: result.travel_time_seconds || 0,
          geometry: {
            type: 'LineString',
            coordinates: result.route_coordinates.map(function (point) {
              return [point.longitude, point.latitude];
            })
          },
          legs: [],
          algorithmStats: result
        };
      });
      if (!routes.length) throw new Error('The selected algorithm found no route between those locations.');
      return routes;
    }

    function scheduleServiceRefresh() {
      clearTimeout(serviceRefreshTimer);
      serviceRefreshTimer = setTimeout(loadServices, 350);
    }

    function showNearbyEmergencyServices() {
      if (window.innerWidth <= 640) {
        collapseSidebar();
        if (serviceDetails) {
          serviceDetails.hidden = true;
          serviceDetails.replaceChildren();
        }
      } else {
        expandSidebar();
      }
      isAssistanceSearch = true;
      emergencySearchType = null;
      form.hidden = false;
      document.body.classList.add('emergency-panel-open');
      if (emergencyOpenButton) {
        emergencyOpenButton.hidden = true;
        emergencyOpenButton.setAttribute('aria-expanded', 'true');
      }
      emergencyAssistance.hidden = false;

      // Ensure emergency options are NOT selected as default
      if (emergencyAssistance) {
        emergencyAssistance.querySelectorAll('[data-emergency-type]').forEach(function (btn) {
          btn.classList.remove('active');
        });
      }
      const situationSelector = document.getElementById('responder-situation-selector');
      if (situationSelector) {
        situationSelector.hidden = true;
        situationSelector.querySelectorAll('.responder-scenario-chip').forEach(function (c) {
          c.classList.remove('active');
        });
      }
      currentResponderScenario = null;
      lastResponderDispatchData = null;

      const assistanceResults = document.getElementById('emergency-assistance-results');
      if (assistanceResults) {
        assistanceResults.hidden = true;
        assistanceResults.replaceChildren();
      }

      const responderBanner = document.getElementById('responder-dispatch-banner');
      if (responderBanner) {
        responderBanner.hidden = true;
        responderBanner.innerHTML = '';
      }

      const emergencyResultsList = document.getElementById('emergency-results-list');
      if (emergencyResultsList) {
        emergencyResultsList.hidden = true;
        emergencyResultsList.replaceChildren();
      }

      // Show Chat with Emergency Assistance button when no options are selected
      const emergencyOpenChat = document.getElementById('emergency-open-chat');
      if (emergencyOpenChat) emergencyOpenChat.hidden = false;

      const emergencyStatusEl = document.getElementById('emergency-status-text');
      if (emergencyStatusEl) emergencyStatusEl.textContent = 'Select an emergency service type below to find the nearest facilities.';
      Object.keys(serviceGroups).forEach(function (groupName) {
        if (groupName.indexOf('emergency') !== 0) return;
        const checkbox = serviceCategoryCheckboxes[groupName];
        if (checkbox && !checkbox.checked) {
          checkbox.checked = true;
          checkbox.dispatchEvent(new Event('change'));
        }
        map.addLayer(serviceGroups[groupName]);
      });

      const focus = userLocationMarker
        ? userLocationMarker.getLatLng()
        : selectedServiceCoordinates
          ? L.latLng(selectedServiceCoordinates[1], selectedServiceCoordinates[0])
          : map.getCenter();
      setStatus('Loading nearby services...');
      if (!userManualZoomActive && map.getZoom() < 14) {
        map.setView(focus, 14);
      } else {
        loadServices();
      }
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function createUnifiedFacilityCard(candidate, index, label, isFirst) {
      const card = document.createElement('div');
      card.className = 'emergency-facility-card' + (isFirst ? ' active-facility' : '');
      card.setAttribute('data-index', String(index));

      const distKm = candidate.distanceMeters >= 1000
        ? (candidate.distanceMeters / 1000).toFixed(1) + ' km'
        : Math.round(candidate.distanceMeters) + ' m';
      const estMins = Math.max(1, Math.round(candidate.distanceMeters / 500));
      const categoryText = candidate.category || (label + ' facility');

      card.innerHTML =
        '<div class="emergency-facility-info">' +
        '<div class="emergency-facility-name">' + (index + 1) + '. ' + escapeHtml(candidate.name) + '</div>' +
        '<div class="emergency-facility-sub">' + escapeHtml(categoryText) + '</div>' +
        '<div class="emergency-facility-badges">' +
        '<span>📍 ' + distKm + '</span>' +
        '<span>⏱ ~' + estMins + ' min drive</span>' +
        (index === 0 ? '<span style="font-weight:700;color:#188038;">• Nearest</span>' : '') +
        '</div>' +
        '</div>' +
        '<button type="button" class="emergency-facility-route-btn">' +
        (isFirst ? 'Active Route' : 'Route') +
        '</button>';

      return card;
    }

    function syncFacilityCardSelection(selectedIndex) {
      document.querySelectorAll('.emergency-facility-card').forEach(function (c) {
        const idx = Number(c.getAttribute('data-index'));
        const isSelected = (idx === selectedIndex);
        c.classList.toggle('active-facility', isSelected);
        const btn = c.querySelector('.emergency-facility-route-btn');
        if (btn) {
          btn.textContent = isSelected ? 'Active Route' : 'Route';
        }
      });
    }

    function renderEmergencyFacilitiesList(candidates, type, customLabel) {
      if (emergencyOpenButton) {
        emergencyOpenButton.hidden = true;
      }
      const typeLabels = {
        ambulance: 'Ambulance',
        responder: 'Rescue / Responder',
        police: 'Police',
        fire: 'Fire Truck'
      };
      const label = customLabel || typeLabels[type] || 'Emergency';

      // 1. Populate the merged list in #emergency-assistance-results (modal dialog)
      const assistanceContainer = document.getElementById('emergency-assistance-results');
      if (assistanceContainer) {
        assistanceContainer.hidden = false;
        assistanceContainer.innerHTML = '';

        if (type === 'responder' && lastResponderDispatchData) {
          const assessDiv = document.createElement('div');
          assessDiv.innerHTML = buildResponderAssessmentHtml(lastResponderDispatchData);
          assistanceContainer.appendChild(assessDiv);
        }

        const header = document.createElement('div');
        header.className = 'emergency-results-header';
        header.innerHTML = '<strong>Nearest ' + label + ' Facilities</strong>' +
          '<span class="emergency-results-count">' + candidates.length + ' nearby</span>';
        assistanceContainer.appendChild(header);

        const listEl = document.createElement('div');
        listEl.className = 'emergency-facility-list';

        candidates.forEach(function (candidate, index) {
          const card = createUnifiedFacilityCard(candidate, index, label, index === 0);

          function handleFacilityRouteSelection(e) {
            if (e) e.stopPropagation();
            syncFacilityCardSelection(index);
            if (emergencyAssistance) {
              emergencyAssistance.hidden = true;
              document.body.classList.remove('emergency-panel-open');
            }
            if (window.innerWidth <= 640) {
              document.body.classList.add('mobile-route-active');
              collapseSidebar();
              if (serviceDetails) {
                serviceDetails.hidden = true;
                serviceDetails.replaceChildren();
              }
            } else {
              const sidebarContainer = document.getElementById('emergency-results-list');
              if (sidebarContainer) {
                sidebarContainer.hidden = false;
              }
            }
            if (emergencyOpenButton) {
              emergencyOpenButton.setAttribute('aria-expanded', 'false');
              syncEmergencyOpenButtonVisibility();
            }
            candidate.selectService();

            const distKm = candidate.distanceMeters >= 1000
              ? (candidate.distanceMeters / 1000).toFixed(1)
              : (candidate.distanceMeters / 1000).toFixed(2);
            const estMins = Math.max(1, Math.round(candidate.distanceMeters / 500));

            showEmergencyRouteConfirmationBar({
              name: candidate.name,
              category: candidate.category || label,
              distKm: distKm,
              durationMins: estMins,
              coordinates: candidate.coordinates || (candidate.geometry && candidate.geometry.coordinates),
              phone: candidate.phone || '',
              type: type
            }, false);

            setStatus('🧭 Route Preview: Routing to ' + candidate.name + ' (~' + estMins + ' min).');

            setTimeout(function () {
              if (typeof map !== 'undefined' && map && typeof map.invalidateSize === 'function') {
                map.invalidateSize();
                if (typeof routeLayers !== 'undefined' && routeLayers.getBounds && routeLayers.getBounds().isValid()) {
                  fitMapBoundsSafely(routeLayers.getBounds(), true);
                }
              }
            }, 120);
          }

          card.addEventListener('click', handleFacilityRouteSelection);
          const routeBtn = card.querySelector('.emergency-facility-route-btn');
          if (routeBtn) {
            routeBtn.addEventListener('click', handleFacilityRouteSelection);
          }

          listEl.appendChild(card);
        });
        assistanceContainer.appendChild(listEl);
      }

      // 2. Populate merged list in sidebar (#emergency-results-list) but keep hidden while modal is open
      const sidebarContainer = document.getElementById('emergency-results-list');
      if (sidebarContainer) {
        sidebarContainer.innerHTML = '';
        // Hide while center modal is active to prevent on-screen duplication
        const modalIsOpen = emergencyAssistance && !emergencyAssistance.hidden;
        sidebarContainer.hidden = modalIsOpen;

        const sHeader = document.createElement('div');
        sHeader.className = 'emergency-results-header';
        sHeader.innerHTML = '<strong>Nearest ' + label + ' Facilities</strong>' +
          '<span class="emergency-results-count">' + candidates.length + ' nearby</span>';
        sidebarContainer.appendChild(sHeader);

        const sList = document.createElement('div');
        sList.className = 'emergency-facility-list';
        sList.style.maxHeight = '200px';

        candidates.forEach(function (candidate, index) {
          const card = createUnifiedFacilityCard(candidate, index, label, index === 0);

          card.addEventListener('click', function () {
            syncFacilityCardSelection(index);

            broadcastUserEmergencyActivity('facility_route_selected', {
              targetFacility: {
                name: candidate.name,
                category: candidate.category || label,
                coordinates: candidate.coordinates || (candidate.geometry && candidate.geometry.coordinates),
                distanceMeters: candidate.distanceMeters,
                phone: candidate.phone || ''
              },
              actionDescription: 'Routed to facility: ' + candidate.name
            });
            candidate.selectService();

            const distKm = candidate.distanceMeters >= 1000
              ? (candidate.distanceMeters / 1000).toFixed(1)
              : (candidate.distanceMeters / 1000).toFixed(2);
            const estMins = Math.max(1, Math.round(candidate.distanceMeters / 500));

            showEmergencyRouteConfirmationBar({
              name: candidate.name,
              category: candidate.category || label,
              distKm: distKm,
              durationMins: estMins,
              coordinates: candidate.coordinates || (candidate.geometry && candidate.geometry.coordinates),
              phone: candidate.phone || '',
              type: type
            }, false);

            setStatus('🧭 Route Preview: Routing to ' + candidate.name + ' (~' + estMins + ' min).');
          });

          sList.appendChild(card);
        });
        sidebarContainer.appendChild(sList);
      }
    }

    function getEmergencyServiceType(tags) {
      const amenity = tags.amenity || '';
      const emergency = tags.emergency || '';
      const healthcare = tags.healthcare || '';
      const name = (tags.name || '').toLowerCase();

      if (amenity === 'ambulance_station' || emergency === 'ambulance_station' || emergency === 'ambulance' ||
        amenity === 'hospital' || healthcare === 'hospital' ||
        amenity === 'clinic' || healthcare === 'clinic' ||
        /hospital|medical center|ambulance|clinic|infirmary|doctor/i.test(name)) {
        return 'ambulance';
      }
      if (amenity === 'police' || emergency === 'police' || tags.police ||
        /police|pnp|precinct|patrol/i.test(name)) {
        return 'police';
      }
      if (amenity === 'fire_station' || emergency === 'fire_station' ||
        emergency === 'fire_service' || tags.fire_station ||
        /fire|bfp|firehouse|fire truck/i.test(name)) {
        return 'fire';
      }
      if (['rescue_station', 'rescue_service', 'rescue', 'lifeguard',
        'disaster_response', 'civil_protection', 'emergency_response',
        'emergency_services'].indexOf(emergency) !== -1 ||
        ['rescue_service', 'disaster_response', 'civil_protection', 'emergency',
          'emergency_services'].indexOf(
            tags.office || ''
          ) !== -1 ||
        /rescue|disaster|red cross|cdrrmo|responder/i.test(name)) {
        return 'responder';
      }
      return '';
    }

    async function findFastestEmergencyCandidate(candidates) {
      const origin = routeOrigin;
      const originPoint = L.latLng(origin[1], origin[0]);
      const nearbyCandidates = candidates.slice().sort(function (a, b) {
        return originPoint.distanceTo(L.latLng(a.coordinates[1], a.coordinates[0])) -
          originPoint.distanceTo(L.latLng(b.coordinates[1], b.coordinates[0]));
      }).slice(0, 20);

      if (esriTrafficApiKey) {
        const trafficCandidates = nearbyCandidates.slice(0, 8);
        const routeResults = await Promise.all(trafficCandidates.map(async function (candidate) {
          try {
            const routes = await findEsriRoute(origin, candidate.coordinates);
            return {
              candidate: candidate,
              duration: routes[0].duration
            };
          } catch (error) {
            console.warn('Could not calculate a traffic-aware candidate route:', error);
            return null;
          }
        }));
        const usableRoutes = routeResults.filter(function (result) {
          return result && Number.isFinite(result.duration);
        });
        if (usableRoutes.length) {
          usableRoutes.sort(function (a, b) { return a.duration - b.duration; });
          return usableRoutes[0].candidate;
        }
      }

      const coordinates = [origin].concat(nearbyCandidates.map(function (candidate) {
        return candidate.coordinates;
      })).map(function (coordinate) {
        return coordinate.join(',');
      }).join(';');
      const destinations = nearbyCandidates.map(function (_, index) {
        return index + 1;
      }).join(';');
      const controller = new AbortController();
      const timeoutId = setTimeout(function () { controller.abort(); }, 12000);

      try {
        const response = await fetch(
          'https://router.project-osrm.org/table/v1/driving/' + coordinates +
          '?sources=0&destinations=' + destinations + '&annotations=duration',
          { signal: controller.signal }
        );
        if (!response.ok) throw new Error('Could not compare emergency-service route times.');
        const data = await response.json();
        const durations = data.code === 'Ok' && data.durations && data.durations[0];
        if (!Array.isArray(durations)) {
          throw new Error('Emergency-service route-time data is unavailable.');
        }
        let fastestIndex = -1;
        let fastestDuration = Infinity;
        durations.forEach(function (duration, index) {
          if (Number.isFinite(duration) && duration < fastestDuration) {
            fastestDuration = duration;
            fastestIndex = index;
          }
        });
        if (fastestIndex < 0) {
          throw new Error('No drivable route was found to the nearby mapped services.');
        }
        return nearbyCandidates[fastestIndex];
      } finally {
        clearTimeout(timeoutId);
      }
    }

    function findFastestEmergencyService(type) {
      lastEmergencyActionTime = Date.now();
      isSearching = false;
      try {
        localStorage.removeItem('responder_cleared_time');
      } catch (e) {}
      const labels = {
        ambulance: 'ambulance facilities & hospitals',
        responder: 'rescue & responder units',
        police: 'police stations',
        fire: 'fire stations & trucks'
      };
      const origin = (userLocationMarker && [userLocationMarker.getLatLng().lng, userLocationMarker.getLatLng().lat]) ||
        userDeviceCoords ||
        routeOrigin ||
        initialCenter ||
        [map.getCenter().lng, map.getCenter().lat];
      routeOrigin = origin;
      emergencySearchType = type;
      isAssistanceSearch = true;
      if (emergencyOpenButton) {
        emergencyOpenButton.hidden = true;
      }

      // Update button active state in modal
      if (emergencyAssistance) {
        emergencyAssistance.querySelectorAll('[data-emergency-type]').forEach(function (btn) {
          btn.classList.toggle('active', btn.dataset.emergencyType === type);
        });
      }

      // Remove / hide chat emergency assistance when an option is selected
      const emergencyOpenChat = document.getElementById('emergency-open-chat');
      if (emergencyOpenChat) emergencyOpenChat.hidden = true;

      const situationSelector = document.getElementById('responder-situation-selector');
      if (situationSelector) {
        situationSelector.hidden = (type !== 'responder');
      }
      const responderBanner = document.getElementById('responder-dispatch-banner');
      if (responderBanner && type !== 'responder') {
        responderBanner.hidden = true;
      }

      if (type === 'responder') {
        const dispatchData = recommendResponderDispatch('', currentResponderScenario || 'flood');
        // On desktop, keep emergencyAssistance open; on mobile collapse so route path is visible
        if (window.innerWidth <= 640) {
          document.body.classList.add('mobile-route-active');
          collapseEmergencyServicePanel();
          if (serviceDetails) {
            serviceDetails.hidden = true;
            serviceDetails.replaceChildren();
          }
          const mapSearchControls = document.getElementById('map-search-controls');
          if (mapSearchControls) mapSearchControls.classList.remove('sidebar-expanded');
          document.body.classList.remove('sidebar-expanded');
          isSidebarExpanded = false;
        } else {
          if (emergencyAssistance) {
            emergencyAssistance.hidden = false;
            document.body.classList.add('emergency-panel-open');
          }
          const situationSelector = document.getElementById('responder-situation-selector');
          if (situationSelector) {
            situationSelector.hidden = false;
          }
          const assistanceContainer = document.getElementById('emergency-assistance-results');
          if (assistanceContainer) {
            assistanceContainer.hidden = false;
            assistanceContainer.innerHTML = buildResponderAssessmentHtml(dispatchData);
          }
          expandSidebar();
        }
        syncEmergencyOpenButtonVisibility();
        plotResponderRoute(dispatchData);
        showEmergencyRouteConfirmationBar({
          name: dispatchData.responder.name,
          category: dispatchData.responder.category,
          distKm: dispatchData.metrics.distKm,
          durationMins: dispatchData.metrics.durationMins,
          coordinates: dispatchData.responder.coordinates,
          phone: dispatchData.responder.phone,
          dispatchData: dispatchData,
          type: 'responder'
        }, false);
        setStatus('🧭 Route Preview: Viewing nearest responder route to ' + dispatchData.responder.name + ' (~' + dispatchData.metrics.durationMins + ' min).');
      } else {
        // Immediately compute fastest route to the nearest known facility for police, fire, ambulance
        const originPoint = L.latLng(origin[1], origin[0]);
        const knownForType = KNOWN_EMERGENCY_FACILITIES.filter(function (f) {
          return f.type === type;
        }).map(function (known) {
          return {
            name: known.name,
            category: known.category,
            coordinates: known.coordinates,
            address: known.address,
            phone: known.phone,
            type: known.type,
            distanceMeters: originPoint.distanceTo(L.latLng(known.coordinates[1], known.coordinates[0])),
            selectService: function () {
              selectedServiceCoordinates = known.coordinates;
              if (window.innerWidth > 640) {
                expandSidebar();
              }
              destinationInput.value = known.name;
              showServiceDetails(
                known.name,
                known.category,
                [
                  ['Address', known.address],
                  ['Phone', known.phone, 'phone'],
                  ['Category', known.category]
                ],
                '#d93025',
                '',
                {
                  callNumber: known.phone,
                  messageNumber: known.phone,
                  type: known.type,
                  onNeedAssistance: function () {
                    openAssistanceChat({
                      name: known.name,
                      category: known.category,
                      phone: known.phone,
                      coordinates: known.coordinates,
                      address: known.address,
                      type: known.type
                    });
                  }
                }
              );
              searchDestination(known.name, known.coordinates, { emergencyType: type, facility: known });
            }
          };
        });

        knownForType.sort(function (a, b) {
          return a.distanceMeters - b.distanceMeters;
        });

        if (knownForType.length > 0) {
          // On desktop keep open; on mobile collapse so route path is visible
          if (window.innerWidth <= 640) {
            document.body.classList.add('mobile-route-active');
            collapseEmergencyServicePanel();
            if (serviceDetails) {
              serviceDetails.hidden = true;
              serviceDetails.replaceChildren();
            }
            const mapSearchControls = document.getElementById('map-search-controls');
            if (mapSearchControls) mapSearchControls.classList.remove('sidebar-expanded');
            document.body.classList.remove('sidebar-expanded');
            isSidebarExpanded = false;
          } else {
            if (emergencyAssistance) {
              emergencyAssistance.hidden = false;
              document.body.classList.add('emergency-panel-open');
            }
          }
          const sidebarContainer = document.getElementById('emergency-results-list');
          syncEmergencyOpenButtonVisibility();
          if (sidebarContainer) {
            sidebarContainer.hidden = (window.innerWidth <= 640);
          }

          // Populate options list on desktop
          if (window.innerWidth > 640) {
            renderEmergencyFacilitiesList(knownForType.slice(0, 8), type);
          }

          const nearest = knownForType[0];
          const distKm = (nearest.distanceMeters / 1000).toFixed(1);
          const estMins = Math.max(1, Math.round(nearest.distanceMeters / 500));
          nearest.selectService();

          showEmergencyRouteConfirmationBar({
            name: nearest.name,
            category: nearest.category,
            distKm: distKm,
            durationMins: estMins,
            coordinates: nearest.coordinates,
            phone: nearest.phone,
            type: type
          }, false);

          setStatus('🧭 Route Preview: Viewing nearest route to ' + (labels[type] || type) + ': ' + nearest.name + ' (~' + estMins + ' min).');
        }
      }

      // Ensure appropriate layer is visible
      const layerMapping = {
        ambulance: ['healthHospitals', 'healthClinics', 'emergencyAmbulance'],
        police: ['emergencyPolice'],
        fire: ['emergencyFire'],
        responder: ['emergencyResponders']
      };
      (layerMapping[type] || []).forEach(function (groupName) {
        if (serviceGroups[groupName]) {
          map.addLayer(serviceGroups[groupName]);
          const cb = serviceCategoryCheckboxes[groupName];
          if (cb && !cb.checked) {
            cb.checked = true;
          }
        }
      });

      const statusMsg = 'Finding nearest ' + (labels[type] || type) + '...';
      setStatus(statusMsg);
      const emergencyStatusEl = document.getElementById('emergency-status-text');

      broadcastUserEmergencyActivity('service_change', {
        serviceType: type,
        serviceLabel: labels[type] || type,
        actionDescription: 'Selected ' + (type === 'fire' ? 'Fire Truck' : type === 'responder' ? 'Rescue / Responder' : type.charAt(0).toUpperCase() + type.slice(1)) + ' service'
      });
      if (emergencyStatusEl) emergencyStatusEl.textContent = statusMsg;

      const focus = L.latLng(origin[1], origin[0]);
      if (!userManualZoomActive && map.getZoom() < 14) {
        map.setView(focus, 14);
      }
      loadServices();
    }

    async function loadServices() {
      const requestId = ++serviceRequestId;
      const requestedEmergencyType = emergencySearchType;
      if (serviceRequestController) serviceRequestController.abort();
      if (map.getZoom() < 12) {
        serviceMarkerGroups.forEach(function (group) { group.clearLayers(); });
        if (hasUserInteracted && !isSearching && !/route/i.test(status.textContent)) {
          setStatus('Zoom in to view nearby health and emergency services.');
        }
        return;
      }

      const shouldUpdateServiceStatus = hasUserInteracted && !isSearching &&
        (!status.classList.contains('visible') ||
          /mapped services|Loading nearby services|Zoom in to view nearby/.test(status.textContent));
      if (shouldUpdateServiceStatus) setStatus('Loading nearby services...');
      const bounds = map.getBounds();
      const bbox = [
        bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()
      ].map(function (coordinate) { return coordinate.toFixed(5); }).join(',');
      const params = new URLSearchParams({
        bbox: bbox,
        limit: '100',
        lang: 'en'
      });
      params.set(
        'include',
        (requestedEmergencyType
          ? emergencyRouteFilters[requestedEmergencyType]
          : isAssistanceSearch ? emergencyServiceFilters : serviceCategoryFilters).join(',')
      );
      const controller = new AbortController();
      const timeoutId = setTimeout(function () { controller.abort(); }, 15000);
      serviceRequestController = controller;

      try {
        const response = await fetch('https://photon.komoot.io/api/?' + params.toString(), {
          signal: controller.signal
        });
        if (!response.ok) throw new Error('Service search returned HTTP ' + response.status + '.');
        const data = await response.json();
        if (requestId !== serviceRequestId) return;
        if (!Array.isArray(data.features)) throw new Error('Service search returned invalid data.');
        writeOfflineCache('nearby-services:' + bbox + ':' +
          (isAssistanceSearch ? 'emergency' : 'standard'), data.features);

        serviceMarkerGroups.forEach(function (group) { group.clearLayers(); });
        let addedCount = 0;
        let emergencyCount = 0;
        const emergencyCandidates = [];
        data.features.forEach(function (feature) {
          const properties = feature.properties || {};
          const coordinates = feature.geometry && feature.geometry.coordinates;
          if (!Array.isArray(coordinates) || coordinates.length < 2) return;
          const longitude = coordinates[0];
          const latitude = coordinates[1];
          if (typeof latitude !== 'number' || typeof longitude !== 'number') return;

          const tags = properties.extra && typeof properties.extra === 'object' ?
            Object.assign({}, properties.extra) : {};
          if (properties.osm_key && properties.osm_value) {
            tags[properties.osm_key] = properties.osm_value;
          }
          if (properties.name) tags.name = properties.name;
          if (properties.housenumber) tags['addr:housenumber'] = properties.housenumber;
          if (properties.street) tags['addr:street'] = properties.street;
          if (properties.city) tags['addr:city'] = properties.city;

          const categoryValue = tags.healthcare || tags.amenity || tags.emergency || tags.shop ||
            tags.office ||
            properties.osm_value || 'service';
          const category = categoryValue.replace(/_/g, ' ');
          const categoryLabel = category.replace(/\b\w/g, function (letter) {
            return letter.toUpperCase();
          });
          const name = tags.name || categoryLabel;
          const emergencyValue = tags.emergency && tags.emergency !== 'yes' && tags.emergency !== 'no'
            ? tags.emergency : tags.office && serviceCategoryGroupByValue[tags.office] ? tags.office : '';
          const healthValue = tags.healthcare ||
            (tags.shop && serviceCategoryGroupByValue[tags.shop] &&
              serviceCategoryGroupByValue[tags.shop].indexOf('health') === 0 ? tags.shop : '') ||
            (tags.amenity && serviceCategoryGroupByValue[tags.amenity] &&
              serviceCategoryGroupByValue[tags.amenity].indexOf('health') === 0 ? tags.amenity : '');
          const serviceGroupName = serviceCategoryGroupByValue[emergencyValue] ||
            serviceCategoryGroupByValue[tags.amenity] ||
            serviceCategoryGroupByValue[healthValue] ||
            (emergencyValue ? 'emergencyResponders' : tags.healthcare ? 'healthOther' : '');
          if (!serviceGroupName) return;
          const isEmergency = serviceGroupName.indexOf('emergency') === 0;
          const emergencyServiceType = getEmergencyServiceType(tags);
          const isHealth = serviceGroupName.indexOf('health') === 0;
          const color = isEmergency ? '#d93025' : isHealth ? '#188038' : '#1a73e8';
          const markerGroup = serviceGroups[serviceGroupName];
          const pin = document.createElement('div');
          pin.className = 'service-pin';
          pin.style.setProperty('--service-color', color);
          const badge = document.createElement('span');
          badge.className = 'service-badge';
          badge.style.backgroundColor = color;
          badge.textContent = serviceSymbols[categoryValue] ||
            (isEmergency ? '!' : isHealth ? '✚' : '•');
          const label = document.createElement('span');
          label.className = 'service-name';
          label.textContent = tags.name ? name + ' · ' + category : name;
          const labelWidth = Math.min(210, Math.max(50, label.textContent.length * 7));
          pin.append(badge, label);

          const icon = L.divIcon({
            className: 'service-div-icon',
            html: pin,
            iconSize: [labelWidth + 30, 28],
            iconAnchor: [11, 14]
          });
          const marker = L.marker([latitude, longitude], {
            icon: icon,
            title: name + ' (' + category + ')',
            alt: name,
            bubblingMouseEvents: false
          }).addTo(markerGroup);

          const osmObjectTypes = { N: 'node', W: 'way', R: 'relation' };
          const osmObjectType = osmObjectTypes[properties.osm_type] || '';
          const osmObjectId = String(properties.osm_id || '');
          const calculatedType = emergencyServiceType || (
            serviceGroupName === 'emergencyPolice' ? 'police' :
            serviceGroupName === 'emergencyFire' ? 'fire' :
            serviceGroupName === 'emergencyResponders' ? 'responder' :
            (serviceGroupName === 'emergencyAmbulance' || serviceGroupName === 'healthHospitals' || isHealth) ? 'ambulance' : null
          );
          const getActions = function () {
            const phoneNumber = normalizePhoneNumber(tags.phone) ||
              normalizePhoneNumber(tags['contact:phone']) ||
              normalizePhoneNumber(tags.mobile) ||
              normalizePhoneNumber(tags['contact:mobile']);
            const mobileNumber = normalizePhoneNumber(tags['contact:mobile']) ||
              normalizePhoneNumber(tags.mobile);
            return {
              callNumber: phoneNumber,
              messageNumber: mobileNumber || phoneNumber,
              type: calculatedType,
              onNeedAssistance: function () {
                openAssistanceChat({
                  name: name,
                  category: categoryLabel,
                  phone: phoneNumber,
                  coordinates: [longitude, latitude],
                  type: calculatedType
                });
              }
            };
          };
          const getDetails = function () {
            const openingStatus = getOpeningStatus(tags.opening_hours, [longitude, latitude]);
            const missingInfo = 'Not listed';
            const address = tags['addr:full'] || [
              tags['addr:housenumber'],
              tags['addr:street'] || properties.street,
              tags['addr:city'] || properties.city,
              properties.postcode
            ].filter(Boolean).join(' ');
            const phone = tags.phone || tags['contact:phone'];
            const mobile = tags['contact:mobile'] || tags.mobile;
            const email = tags.email || tags['contact:email'];
            const website = tags.website || tags['contact:website'] || tags.url;
            return [
              ['Address', address || missingInfo],
              ['Phone', phone || missingInfo, phone ? 'phone' : ''],
              ['Mobile', mobile || missingInfo, mobile ? 'phone' : ''],
              ['Email', email || missingInfo, email ? 'email' : ''],
              ['Website', website || missingInfo, website ? 'website' : ''],
              ['Fax', tags.fax || tags['contact:fax']],
              ['Brand', tags.brand],
              ['Hours', openingStatus.status, 'status', openingStatus.state],
              ['Opening schedule', openingStatus.schedule],
              ['Operator', tags.operator],
              ['Description', tags['description:en'] || tags.description],
              ['Services', tags['healthcare:speciality'] || tags.healthcare_speciality],
              ['Wheelchair access', tags.wheelchair],
              ['Payment', [
                tags['payment:cash'] ? 'Cash: ' + tags['payment:cash'] : '',
                tags['payment:cards'] ? 'Cards: ' + tags['payment:cards'] : ''
              ].filter(Boolean).join('; ')],
            ].concat(getSocialDetails(tags));
          };
          const selectService = function (routePurpose) {
            document.querySelectorAll('.service-pin.expanded').forEach(function (expandedPin) {
              expandedPin.classList.remove('expanded');
            });
            pin.classList.add('expanded');
            selectedServiceCoordinates = [longitude, latitude];
            expandSidebar();
            const selectedDetails = getDetails();
            recordActivity('selected_place', {
              name: name,
              category: categoryLabel,
              osmType: osmObjectType || null,
              osmId: osmObjectId || null,
              coordinates: [longitude, latitude],
              details: selectedDetails
                .filter(function (detail) { return detail[1]; })
                .map(function (detail) { return { label: detail[0], value: detail[1] }; })
            });
            const detailsRequestId = ++serviceDetailsRequestId;
            showServiceDetails(
              name,
              categoryLabel,
              selectedDetails,
              color,
              osmObjectType && /^\d+$/.test(osmObjectId)
                ? 'Loading additional information from OpenStreetMap...'
                : '',
              getActions()
            );
            if (tags.opening_hours && tags.opening_hours !== '24/7' && typeof window.opening_hours !== 'function') {
              loadScriptOnce('opening hours library', 'vendor/opening-hours/opening_hours+deps.min.js', function () {
                return typeof window.opening_hours === 'function';
              }).then(function () {
                if (detailsRequestId === serviceDetailsRequestId) {
                  showServiceDetails(name, categoryLabel, getDetails(), color, '', getActions());
                }
              }).catch(function (error) {
                console.warn('Opening hours could not be loaded:', error);
              });
            }
            if (osmObjectType && /^\d+$/.test(osmObjectId)) {
              loadOpenStreetMapDetails(
                osmObjectType,
                osmObjectId,
                tags,
                name,
                categoryLabel,
                getDetails,
                getActions,
                color,
                detailsRequestId
              );
            }
            destinationInput.value = name;
            searchDestination(name, [longitude, latitude], routePurpose);
          };
          label.addEventListener('click', function (event) {
            L.DomEvent.stopPropagation(event);
            selectService();
          });
          marker.on('click', selectService);
          if (requestedEmergencyType) {
            const matchesType = (requestedEmergencyType === 'ambulance' &&
              (emergencyServiceType === 'ambulance' ||
                serviceGroupName === 'healthHospitals' ||
                serviceGroupName === 'emergencyAmbulance' ||
                tags.amenity === 'hospital' ||
                tags.healthcare === 'hospital' ||
                tags.amenity === 'clinic' ||
                tags.amenity === 'ambulance_station' ||
                /hospital|medical center|ambulance|clinic/i.test(tags.name || ''))) ||
              (requestedEmergencyType === 'police' &&
                (emergencyServiceType === 'police' ||
                  serviceGroupName === 'emergencyPolice' ||
                  tags.amenity === 'police' ||
                  /police|pnp|precinct/i.test(tags.name || ''))) ||
              (requestedEmergencyType === 'fire' &&
                (emergencyServiceType === 'fire' ||
                  serviceGroupName === 'emergencyFire' ||
                  tags.amenity === 'fire_station' ||
                  tags.emergency === 'fire_station' ||
                  tags.emergency === 'fire_service' ||
                  /fire|bfp/i.test(tags.name || ''))) ||
              (requestedEmergencyType === 'responder' &&
                (emergencyServiceType === 'responder' ||
                  serviceGroupName === 'emergencyResponders' ||
                  /rescue|disaster|red cross|responder/i.test(tags.name || '')));

            if (matchesType) {
              emergencyCandidates.push({
                name: name,
                category: categoryLabel,
                coordinates: [longitude, latitude],
                address: tags['addr:street'] || tags['addr:city'] || '',
                phone: tags.phone || tags['contact:phone'] || '',
                type: requestedEmergencyType || emergencyServiceType,
                selectService: function () {
                  selectService({ emergencyType: requestedEmergencyType });
                }
              });
            }
          }
          addedCount += 1;
          if (isEmergency) emergencyCount += 1;
        });

        if (requestedEmergencyType && requestId === serviceRequestId) {
          emergencySearchType = null;
          isAssistanceSearch = false;

          const origin = routeOrigin || (userLocationMarker && [userLocationMarker.getLatLng().lng, userLocationMarker.getLatLng().lat]) || initialCenter;
          const originPoint = L.latLng(origin[1], origin[0]);

          // Merge verified known emergency facilities for requested type
          const knownForType = KNOWN_EMERGENCY_FACILITIES.filter(function (f) {
            return f.type === requestedEmergencyType;
          });

          knownForType.forEach(function (known) {
            const exists = emergencyCandidates.some(function (cand) {
              const d = L.latLng(cand.coordinates[1], cand.coordinates[0]).distanceTo(
                L.latLng(known.coordinates[1], known.coordinates[0])
              );
              return d < 120 || cand.name.toLowerCase().includes(known.name.toLowerCase().substring(0, 10));
            });
            if (!exists) {
              const targetGroup = serviceGroups[
                requestedEmergencyType === 'ambulance' ? 'healthHospitals' :
                  requestedEmergencyType === 'police' ? 'emergencyPolice' :
                    requestedEmergencyType === 'fire' ? 'emergencyFire' : 'emergencyResponders'
              ];
              if (targetGroup) {
                const pin = document.createElement('div');
                pin.className = 'service-pin';
                const color = '#d93025';
                pin.style.setProperty('--service-color', color);
                const badge = document.createElement('span');
                badge.className = 'service-badge';
                badge.style.backgroundColor = color;
                badge.textContent = requestedEmergencyType === 'ambulance' ? '✚' :
                  requestedEmergencyType === 'police' ? 'P' :
                    requestedEmergencyType === 'fire' ? 'F' : 'R';
                const label = document.createElement('span');
                label.className = 'service-name';
                label.textContent = known.name;
                pin.append(badge, label);

                const icon = L.divIcon({
                  className: 'service-div-icon',
                  html: pin,
                  iconSize: [Math.min(210, Math.max(50, known.name.length * 7)) + 30, 28],
                  iconAnchor: [11, 14]
                });
                const marker = L.marker([known.coordinates[1], known.coordinates[0]], {
                  icon: icon,
                  title: known.name,
                  alt: known.name,
                  bubblingMouseEvents: false
                }).addTo(targetGroup);

                const selectKnown = function () {
                  pin.classList.add('expanded');
                  selectedServiceCoordinates = known.coordinates;
                  expandSidebar();
                  destinationInput.value = known.name;
                  showServiceDetails(
                    known.name,
                    known.category,
                    [
                      ['Address', known.address],
                      ['Phone', known.phone, 'phone'],
                      ['Category', known.category]
                    ],
                    '#d93025',
                    '',
                    {
                      callNumber: known.phone,
                      messageNumber: known.phone,
                      type: known.type,
                      onNeedAssistance: function () {
                        openAssistanceChat({
                          name: known.name,
                          category: known.category,
                          phone: known.phone,
                          coordinates: known.coordinates,
                          address: known.address,
                          type: known.type
                        });
                      }
                    }
                  );
                  searchDestination(known.name, known.coordinates, { emergencyType: requestedEmergencyType });
                };
                marker.on('click', selectKnown);
                pin.addEventListener('click', function (e) {
                  L.DomEvent.stopPropagation(e);
                  selectKnown();
                });
              }

              emergencyCandidates.push({
                name: known.name,
                category: known.category,
                coordinates: known.coordinates,
                address: known.address,
                phone: known.phone,
                selectService: function () {
                  selectedServiceCoordinates = known.coordinates;
                  expandSidebar();
                  destinationInput.value = known.name;
                  showServiceDetails(
                    known.name,
                    known.category,
                    [
                      ['Address', known.address],
                      ['Phone', known.phone, 'phone'],
                      ['Category', known.category]
                    ],
                    '#d93025',
                    '',
                    {
                      callNumber: known.phone,
                      messageNumber: known.phone,
                      type: known.type,
                      onNeedAssistance: function () {
                        openAssistanceChat({
                          name: known.name,
                          category: known.category,
                          phone: known.phone,
                          coordinates: known.coordinates,
                          address: known.address,
                          type: known.type
                        });
                      }
                    }
                  );
                  searchDestination(known.name, known.coordinates, { emergencyType: requestedEmergencyType });
                }
              });
            }
          });

          // Calculate distance for all candidates from originPoint
          emergencyCandidates.forEach(function (cand) {
            cand.distanceMeters = originPoint.distanceTo(L.latLng(cand.coordinates[1], cand.coordinates[0]));
          });

          // Sort by distance ascending
          emergencyCandidates.sort(function (a, b) {
            return a.distanceMeters - b.distanceMeters;
          });

          if (emergencyCandidates.length === 0) {
            const labels = {
              ambulance: 'ambulance facilities',
              responder: 'emergency responder or rescue facilities',
              police: 'police stations',
              fire: 'fire stations'
            };
            setStatus('No mapped ' + (labels[requestedEmergencyType] || 'facilities') +
              ' were found nearby. For immediate danger, call your local emergency number.');
          } else {
            // Render the full list of nearest facilities (top 8) in both modal and sidebar
            renderEmergencyFacilitiesList(emergencyCandidates.slice(0, 8), requestedEmergencyType);

            // Render nearby candidates list without auto-routing until confirmed
            const nearest = emergencyCandidates[0];
            const distKm = (nearest.distanceMeters / 1000).toFixed(1);
            setStatus('Found ' + emergencyCandidates.length + ' nearby ' + requestedEmergencyType + ' facilities. Nearest: ' + nearest.name + ' (' + distKm + ' km away). Confirm emergency to view route.');
          }
        }

        if (status.textContent === 'Loading nearby services...' || isAssistanceSearch) {
          if (isAssistanceSearch) {
            const assistanceMsg = emergencyCount
              ? emergencyCount + ' mapped emergency services found nearby. Select a pin for contact details and directions. For immediate danger, contact local emergency services.'
              : 'No mapped emergency services found nearby. For immediate danger, contact local emergency services.';
            setStatus(assistanceMsg);
            const emergencyStatusEl = document.getElementById('emergency-status-text');
            if (emergencyStatusEl) emergencyStatusEl.textContent = assistanceMsg;
            isAssistanceSearch = false;
          } else {
            setStatus(addedCount
              ? addedCount + ' mapped services from OpenStreetMap. Select a pin for details and routes.'
              : 'No mapped health or emergency services in this map area.');
          }
        }
      } catch (error) {
        if (requestId !== serviceRequestId) return;
        console.error('Could not load map services:', error);
        if (requestedEmergencyType) {
          emergencySearchType = null;
          isAssistanceSearch = false;
          const origin = routeOrigin || (userLocationMarker && [userLocationMarker.getLatLng().lng, userLocationMarker.getLatLng().lat]) || initialCenter;
          const originPoint = L.latLng(origin[1], origin[0]);
          const knownCandidates = KNOWN_EMERGENCY_FACILITIES.filter(function (f) {
            return f.type === requestedEmergencyType;
          }).map(function (known) {
            return {
              name: known.name,
              category: known.category,
              coordinates: known.coordinates,
              address: known.address,
              phone: known.phone,
              distanceMeters: originPoint.distanceTo(L.latLng(known.coordinates[1], known.coordinates[0])),
              selectService: function () {
                selectedServiceCoordinates = known.coordinates;
                expandSidebar();
                destinationInput.value = known.name;
                showServiceDetails(
                  known.name,
                  known.category,
                  [
                    ['Address', known.address],
                    ['Phone', known.phone, 'phone'],
                    ['Category', known.category]
                  ],
                  '#d93025',
                  '',
                  {
                    callNumber: known.phone,
                    messageNumber: known.phone,
                    type: known.type,
                    onNeedAssistance: function () {
                      openAssistanceChat({
                        name: known.name,
                        category: known.category,
                        phone: known.phone,
                        coordinates: known.coordinates,
                        address: known.address,
                        type: known.type
                      });
                    }
                  }
                );
                searchDestination(known.name, known.coordinates, { emergencyType: requestedEmergencyType });
              }
            };
          });
          knownCandidates.sort(function (a, b) { return a.distanceMeters - b.distanceMeters; });
          if (knownCandidates.length) {
            renderEmergencyFacilitiesList(knownCandidates.slice(0, 8), requestedEmergencyType);
            knownCandidates[0].selectService();
            return;
          }
        }
        emergencySearchType = null;
        if (hasUserInteracted && !isSearching) {
          setStatus('Could not load service locations. Please try again later.');
        }
        isAssistanceSearch = false;
      } finally {
        clearTimeout(timeoutId);
        if (serviceRequestController === controller) serviceRequestController = null;
      }
    }

    async function searchDestination(destination, knownCoordinates, routePurpose, originOverride) {
      lastEmergencyActionTime = Date.now();
      isSearching = false;
      try {
        localStorage.removeItem('responder_cleared_time');
      } catch (e) {}
      if (isSearching) return;
      const requestId = ++searchRequestId;
      markUserInteracted();
      if (window.innerWidth > 640 || !routePurpose) {
        expandSidebar();
      }
      recordActivity('search', { query: destination });
      broadcastUserEmergencyActivity('search', { destination: destination, actionDescription: 'Searched destination: ' + destination });
      isSearching = true;
      searchButton.disabled = true;
      setStatus('Searching factor-aware routes...');
      routeLayers.clearLayers();
      routesElement.replaceChildren();
      if (destinationMarker) {
        map.removeLayer(destinationMarker);
        destinationMarker = null;
      }
      if (originMarker) {
        map.removeLayer(originMarker);
        originMarker = null;
      }

      try {
        const end = knownCoordinates || await findLocation(destination);
        if (requestId !== searchRequestId) return;
        const popupContent = document.createElement('span');
        popupContent.textContent = 'Destination: ' + destination;
        if (routePurpose && routePurpose.emergencyType === 'responder' && routePurpose.dispatchData) {
          const pin = document.createElement('div');
          pin.className = 'service-pin';
          pin.style.setProperty('--service-color', '#d93025');
          const badge = document.createElement('span');
          badge.className = 'service-badge';
          badge.style.backgroundColor = '#d93025';
          badge.textContent = '🚨';
          const label = document.createElement('span');
          label.className = 'service-name';
          label.textContent = 'Incident Site (' + destination + ')';
          pin.append(badge, label);

          const icon = L.divIcon({
            className: 'service-div-icon',
            html: pin,
            iconSize: [Math.min(220, Math.max(70, label.textContent.length * 7)) + 30, 28],
            iconAnchor: [11, 14]
          });
          destinationMarker = L.marker([end[1], end[0]], { icon: icon }).addTo(map).bindPopup(
            '<strong>🚨 Incident Site (Detected Location)</strong><br>' +
            'Scenario: ' + escapeHtml(routePurpose.dispatchData.scenario.title) + '<br>' +
            'Location: ' + escapeHtml(routePurpose.dispatchData.userLoc.districtName)
          );
        } else {
          destinationMarker = L.marker([end[1], end[0]]).addTo(map).bindPopup(popupContent);
        }

        // Resolve user source / origin
        let start = originOverride;
        if (!start) {
          const sourceVal = sourceInput ? sourceInput.value.trim() : '';
          if (sourceVal && !/device location|my location|your location/i.test(sourceVal)) {
            try {
              start = parseCoordinates(sourceVal);
            } catch (e) {
              start = null;
            }
            if (!start) {
              try {
                start = await findLocation(sourceVal);
              } catch (e) {
                console.warn('Could not geocode source location:', e);
                start = null;
              }
            }
          }
        }
        if (!start) {
          start = userDeviceCoords || routeOrigin || initialCenter;
        }

        const originPopup = document.createElement('span');
        if (routePurpose && routePurpose.emergencyType === 'responder' && routePurpose.dispatchData) {
          originPopup.textContent = '🚨 Responder Station: ' + routePurpose.dispatchData.responder.name;
        } else {
          originPopup.textContent = 'Starting point: ' + (sourceInput && sourceInput.value ? sourceInput.value : 'Your location');
        }
        originMarker = L.circleMarker([start[1], start[0]], {
          radius: 8,
          color: '#fff',
          weight: 3,
          fillColor: (routePurpose && routePurpose.emergencyType === 'responder') ? '#d93025' : '#1a73e8',
          fillOpacity: 1
        }).addTo(map).bindPopup(originPopup);

        const selectedAlgorithm = routeAlgorithmInput ? routeAlgorithmInput.value : 'osrm';
        let usesLiveTraffic = selectedAlgorithm === 'osrm' && Boolean(esriTrafficApiKey);
        let routes;
        if (selectedAlgorithm !== 'osrm') {
          routes = await findAlgorithmRoutes(start, end, selectedAlgorithm);
        } else if (usesLiveTraffic) {
          try {
            routes = await findEsriRoute(start, end);
          } catch (trafficError) {
            if (requestId !== searchRequestId) return;
            console.warn('Traffic route unavailable; using standard routing:', trafficError);
            usesLiveTraffic = false;
            routes = await findStandardRoutes(start, end);
          }
        } else {
          routes = await findStandardRoutes(start, end);
        }
        if (requestId !== searchRequestId) return;

        // Automatically evaluate live traffic and live events on the fastest route
        const useTraffic = true;
        const useEvents = true;

        // Initialize baseline metrics on all routes
        routes.forEach(function (route) {
          route.baseDuration = route.duration;
          route.trafficDelaySeconds = 0;
          route.eventDelaySeconds = 0;
          route.totalDelaySeconds = 0;
          route.incidentCollisions = [];
          route.trafficDelays = [];
          route.isBlocked = false;
        });

        // Compute traffic and live event delays ONLY on the fastest route
        if (routes.length > 0) {
          const fastestRoute = routes[0];

          // 1. Check live event / hazard spatial collisions on fastest route
          if (useEvents && Array.isArray(fastestRoute.geometry && fastestRoute.geometry.coordinates)) {
            const coords = fastestRoute.geometry.coordinates;
            const collided = new Map();
            coords.forEach(function (pt) {
              const ptLon = pt[0];
              const ptLat = pt[1];
              liveIncidents.forEach(function (inc) {
                if (haversineMeters(ptLat, ptLon, inc.lat, inc.lng) <= inc.radius) {
                  collided.set(inc.id, inc);
                }
              });
            });

            collided.forEach(function (inc) {
              fastestRoute.incidentCollisions.push(inc);
              if (inc.impassable) {
                fastestRoute.isBlocked = true;
                fastestRoute.blockedBy = inc.name;
              } else if (Number.isFinite(inc.penaltySeconds)) {
                fastestRoute.eventDelaySeconds += inc.penaltySeconds;
              }
            });
          }

          // 2. Check road congestion delays on steps of fastest route
          if (useTraffic) {
            (fastestRoute.legs || []).forEach(function (leg) {
              (leg.steps || []).forEach(function (step) {
                const road = step.name || '';
                if (road && trafficCongestedRoads[road]) {
                  const multiplier = trafficCongestedRoads[road];
                  step.trafficCongestion = multiplier;
                  const extraSec = Math.round(step.duration * (multiplier - 1));
                  fastestRoute.trafficDelaySeconds += extraSec;
                  if (!fastestRoute.trafficDelays.some(function (t) { return t.road === road; })) {
                    fastestRoute.trafficDelays.push({ road: road, multiplier: multiplier, extraSec: extraSec });
                  }
                }
                if (useEvents && step.maneuver && step.maneuver.location) {
                  const mLoc = step.maneuver.location;
                  liveIncidents.forEach(function (inc) {
                    if (haversineMeters(mLoc[1], mLoc[0], inc.lat, inc.lng) <= inc.radius + 40) {
                      step.incidentTag = inc.icon + ' Near ' + inc.name;
                    }
                  });
                }
              });
            });
          }

          // Calculate how travel time affects the fastest route overall
          fastestRoute.totalDelaySeconds = fastestRoute.trafficDelaySeconds + fastestRoute.eventDelaySeconds;
          fastestRoute.duration = fastestRoute.baseDuration + fastestRoute.totalDelaySeconds;

          // If the fastest route is blocked by an impassable closure, find a safe alternative or detour
          if (useEvents && fastestRoute.isBlocked) {
            const unblockedAlt = routes.slice(1).find(function (r) {
              let isClear = true;
              if (Array.isArray(r.geometry && r.geometry.coordinates)) {
                r.geometry.coordinates.forEach(function (pt) {
                  liveIncidents.forEach(function (inc) {
                    if (inc.impassable && haversineMeters(pt[1], pt[0], inc.lat, inc.lng) <= inc.radius) {
                      isClear = false;
                    }
                  });
                });
              }
              return isClear;
            });

            if (unblockedAlt) {
              const altIdx = routes.indexOf(unblockedAlt);
              routes.splice(altIdx, 1);
              routes.unshift(unblockedAlt);
              unblockedAlt.isDetourBypass = true;
              unblockedAlt.bypassedIncident = fastestRoute.blockedBy;
              // Evaluate traffic on the newly promoted fastest route
              if (useTraffic) {
                (unblockedAlt.legs || []).forEach(function (leg) {
                  (leg.steps || []).forEach(function (step) {
                    const road = step.name || '';
                    if (road && trafficCongestedRoads[road]) {
                      const multiplier = trafficCongestedRoads[road];
                      step.trafficCongestion = multiplier;
                      const extraSec = Math.round(step.duration * (multiplier - 1));
                      unblockedAlt.trafficDelaySeconds += extraSec;
                      unblockedAlt.trafficDelays.push({ road: road, multiplier: multiplier, extraSec: extraSec });
                    }
                  });
                });
              }
              unblockedAlt.totalDelaySeconds = unblockedAlt.trafficDelaySeconds;
              unblockedAlt.duration = unblockedAlt.baseDuration + unblockedAlt.totalDelaySeconds;
            } else {
              const blockedIncident = fastestRoute.incidentCollisions.find(function (i) { return i.impassable; });
              if (blockedIncident) {
                try {
                  const detourDist = (blockedIncident.radius + 180) / 111320.0;
                  const detourLat = blockedIncident.lat + detourDist;
                  const detourLon = blockedIncident.lng + detourDist;
                  const detourQuery = [start, [detourLon, detourLat], end].map(function (p) { return p.join(','); }).join(';');
                  const detourResp = await fetch(
                    'https://router.project-osrm.org/route/v1/driving/' + detourQuery +
                    '?overview=full&geometries=geojson&steps=true'
                  );
                  if (detourResp.ok) {
                    const detourData = await detourResp.json();
                    if (detourData.code === 'Ok' && detourData.routes && detourData.routes[0]) {
                      const detourRoute = detourData.routes[0];
                      detourRoute.baseDuration = detourRoute.duration;
                      detourRoute.isDetourBypass = true;
                      detourRoute.bypassedIncident = blockedIncident.name;
                      detourRoute.eventDelaySeconds = Math.round(detourRoute.duration * 0.15);
                      detourRoute.trafficDelaySeconds = 0;
                      detourRoute.trafficDelays = [];
                      detourRoute.incidentCollisions = [];
                      detourRoute.totalDelaySeconds = detourRoute.eventDelaySeconds;
                      detourRoute.duration = detourRoute.baseDuration + detourRoute.totalDelaySeconds;
                      routes.unshift(detourRoute);
                    }
                  }
                } catch (detourErr) {
                  console.warn('Could not calculate safe detour:', detourErr);
                }
              }
            }
          }
        }

        if (routePurpose && routePurpose.emergencyType) {
          routes = routes.slice().sort(function (a, b) { return a.duration - b.duration; });
        }

        const routeLayerMap = [];
        let primaryLayer = null;

        // Render alternative routes first so they sit underneath, then render fastest on top
        for (let i = routes.length - 1; i >= 0; i--) {
          const route = routes[i];
          const isPrimary = (i === 0);
          const color = route.isBlocked ? '#d93025' : isPrimary ? '#188038' : ['#1684ff', '#ffb300', '#e04f9b'][(i - 1) % 3];

          // High-contrast casing outline for fastest route
          if (isPrimary) {
            L.geoJSON(route.geometry, {
              pane: 'routePane',
              style: {
                color: '#ffffff',
                weight: 12,
                opacity: 0.92,
                lineCap: 'round',
                lineJoin: 'round'
              },
              interactive: false
            }).addTo(routeLayers);
          }

          const layer = L.geoJSON(route.geometry, {
            pane: 'routePane',
            style: {
              color: color,
              weight: isPrimary ? 8 : 5,
              opacity: isPrimary ? 1.0 : 0.65,
              dashArray: route.isBlocked ? '6, 6' : null,
              lineCap: 'round',
              lineJoin: 'round'
            },
            interactive: true
          }).addTo(routeLayers);

          if (isPrimary) {
            primaryLayer = layer;
            layer.bringToFront();
          }

          const tooltipText = (isPrimary ? '⚡ Fastest Route: ' : ('Alternative ' + (i + 1) + ': ')) +
            formatDuration(route.duration) + ' (' + formatDistance(route.distance) + ')';
          layer.bindTooltip(tooltipText, { sticky: true, className: 'route-path-tooltip' });

          routeLayerMap[i] = layer;
        }

        let matchedFacility = (routePurpose && routePurpose.facility) ? routePurpose.facility : null;
        if (!matchedFacility) {
          const lowerDest = (destination || '').trim().toLowerCase();
          matchedFacility = KNOWN_EMERGENCY_FACILITIES.find(function (f) {
            if (end && f.coordinates) {
              const d = L.latLng(end[1], end[0]).distanceTo(L.latLng(f.coordinates[1], f.coordinates[0]));
              if (d < 250) return true;
            }
            const lowerF = f.name.toLowerCase();
            return lowerDest.includes(lowerF) || lowerF.includes(lowerDest);
          });
        }

        const routeCtx = {
          destination: destination,
          startCoordinates: start,
          endCoordinates: end,
          facility: matchedFacility,
          emergencyType: (routePurpose && routePurpose.emergencyType) || (matchedFacility ? matchedFacility.type : null),
          purpose: routePurpose
        };

        routes.forEach(function (route, index) {
          const cardLayer = routeLayerMap[index];
          addRouteCard(route, index, cardLayer, usesLiveTraffic, routeCtx);
          if (cardLayer) {
            cardLayer.on('click', function (e) {
              L.DomEvent.stopPropagation(e);
              const card = routesElement.children[index];
              if (card) {
                routesElement.querySelectorAll('.route-card').forEach(function (otherCard) {
                  otherCard.classList.remove('selected');
                });
                card.classList.add('selected');
                card.open = true;
                if (typeof cardLayer.bringToFront === 'function') {
                  cardLayer.bringToFront();
                }
              }
            });
          }
        });

        fitMapBoundsSafely(routeLayers.getBounds(), Boolean(routePurpose));

        const activeRoute = routes[0];
        let factorStatus = '';
        if (activeRoute && activeRoute.algorithmStats) {
          const stats = activeRoute.algorithmStats;
          factorStatus = stats.algorithm + ' computed the route in ' +
            (stats.execution_time_seconds * 1000).toFixed(2) + ' ms (' +
            (stats.peak_traced_memory_bytes / 1024).toFixed(1) + ' KiB peak traced memory).';
        } else if (activeRoute && activeRoute.isDetourBypass) {
          factorStatus = 'Fastest route: detoured around ' + activeRoute.bypassedIncident + ' (' + formatDuration(activeRoute.duration) + ' overall travel time).';
        } else if (activeRoute && activeRoute.totalDelaySeconds > 60) {
          factorStatus = 'Fastest route: ' + formatDuration(activeRoute.baseDuration) + ' base + ' + formatDuration(activeRoute.totalDelaySeconds) + ' live delay = ' + formatDuration(activeRoute.duration) + ' overall.';
        } else if (activeRoute) {
          factorStatus = 'Fastest route: ' + formatDuration(activeRoute.duration) + ' overall travel time (clear conditions).';
        }

        setStatus(factorStatus + ' ' + (usesLiveTraffic ? 'Live traffic connected.' : 'Live event & hazard detection active.'));

        if (document.body.classList.contains('chat-open') && activeRoute) {
          const calculatedDistKm = (activeRoute.distance / 1000).toFixed(1);
          const calculatedDurationMin = Math.max(1, Math.round(activeRoute.duration / 60));
          const calculatedDelayMin = (activeRoute.totalDelaySeconds && activeRoute.totalDelaySeconds > 60) ? Math.round(activeRoute.totalDelaySeconds / 60) : 0;
          appendBotMessage(
            '✅ <strong>Active Route Plotted on Map:</strong><br>' +
            '• <strong>Destination:</strong> ' + escapeHtml(destination) + '<br>' +
            '• <strong>Total Road Distance:</strong> ' + calculatedDistKm + ' km<br>' +
            '• <strong>Calculated Travel Time:</strong> ~' + calculatedDurationMin + ' min' + (calculatedDelayMin > 0 ? ' (including +' + calculatedDelayMin + ' min live factor delays)' : ' (clear corridor speed)') + '<br>' +
            '• <strong>Corridor Status:</strong> ' + (activeRoute.isDetourBypass ? '🛡️ Safe hazard detour applied' : '⚡ Direct factor-optimized path') + '<br><br>' +
            'Click below to inspect the navigation path and turn-by-turn maneuvers on the map:',
            [
              {
                label: '🗺️ View Route on Map',
                emergency: true,
                action: function () {
                  closeAssistanceChat();
                  if (window.innerWidth <= 640) {
                    collapseSidebar();
                    document.body.classList.add('mobile-route-active');
                    if (serviceDetails) { serviceDetails.hidden = true; serviceDetails.replaceChildren(); }
                  } else {
                    expandSidebar();
                  }
                  if (typeof routeLayers !== 'undefined' && routeLayers.getBounds && routeLayers.getBounds().isValid()) {
                    fitMapBoundsSafely(routeLayers.getBounds(), true);
                  }
                }
              },
              (matchedFacility && matchedFacility.phone ? { label: '📞 Call ' + matchedFacility.phone, href: 'tel:' + matchedFacility.phone.replace(/[^\d+*#;]/g, '') } : null)
            ].filter(Boolean)
          );
        }
      } catch (error) {
        if (requestId !== searchRequestId) return;
        if (routeAlgorithmInput && routeAlgorithmInput.value !== 'osrm') {
          setStatus(error.message || 'The selected algorithm could not calculate a route.');
          return;
        }
        const start = routeOrigin;
        let end = knownCoordinates;
        if (!end) {
          try { end = parseCoordinates(destination); } catch (coordinateError) { end = null; }
        }
        if (!end) {
          end = readOfflineCache('search:' + destination.trim().toLowerCase(), null);
        }
        let cachedRoutes = null;
        if (end) {
          const routeType = esriTrafficApiKey ? 'esri' : 'standard';
          cachedRoutes = readOfflineCache(
            'route:' + routeType + ':' + start.join(',') + ':' + end.join(','),
            null
          );
        }

        let offlineMatchedFacility = (routePurpose && routePurpose.facility) ? routePurpose.facility : null;
        if (!offlineMatchedFacility && end) {
          const lowerDest = (destination || '').trim().toLowerCase();
          offlineMatchedFacility = KNOWN_EMERGENCY_FACILITIES.find(function (f) {
            if (end && f.coordinates) {
              const d = L.latLng(end[1], end[0]).distanceTo(L.latLng(f.coordinates[1], f.coordinates[0]));
              if (d < 250) return true;
            }
            const lowerF = f.name.toLowerCase();
            return lowerDest.includes(lowerF) || lowerF.includes(lowerDest);
          });
        }
        const offlineCtx = {
          destination: destination,
          startCoordinates: start,
          endCoordinates: end,
          facility: offlineMatchedFacility,
          emergencyType: (routePurpose && routePurpose.emergencyType) || (offlineMatchedFacility ? offlineMatchedFacility.type : null),
          purpose: routePurpose
        };

        if (cachedRoutes) {
          routesElement.replaceChildren();
          routeLayers.clearLayers();
          cachedRoutes.forEach(function (route, index) {
            const color = ['#1684ff', '#ffb300', '#e04f9b'][index % 3];
            const layer = L.geoJSON(route.geometry, {
              pane: 'routePane',
              style: {
                color: color, weight: index === 0 ? 8 : 5,
                opacity: index === 0 ? 0.98 : 0.85
              },
              bubblingMouseEvents: false
            }).addTo(routeLayers);
            addRouteCard(route, index, layer, false, offlineCtx);
          });
          fitMapBoundsSafely(routeLayers.getBounds(), Boolean(routePurpose));
          setStatus('Showing a previously saved offline route.');
        } else if (end) {
          // Generate direct offline navigation fallback route so map is never empty
          const originPoint = L.latLng(start[1], start[0]);
          const destPoint = L.latLng(end[1], end[0]);
          const distanceM = Math.round(originPoint.distanceTo(destPoint) * 1.25);
          const durationSec = Math.max(60, Math.round((distanceM / 1000) / 30 * 3600));
          const directRoute = {
            distance: distanceM,
            duration: durationSec,
            geometry: {
              type: 'LineString',
              coordinates: [start, end]
            },
            legs: [{
              distance: distanceM,
              duration: durationSec,
              summary: 'Offline Direct Route',
              steps: [
                {
                  instruction: 'Navigate towards ' + destination + ' (Offline estimate)',
                  distance: distanceM,
                  duration: durationSec
                }
              ]
            }],
            weight_name: 'offline_direct',
            weight: durationSec
          };
          routesElement.replaceChildren();
          routeLayers.clearLayers();
          const layer = L.geoJSON(directRoute.geometry, {
            pane: 'routePane',
            style: {
              color: '#1684ff', weight: 8,
              opacity: 0.98
            },
            bubblingMouseEvents: false
          }).addTo(routeLayers);
          addRouteCard(directRoute, 0, layer, false, offlineCtx);
          fitMapBoundsSafely(routeLayers.getBounds(), Boolean(routePurpose));
          setStatus('Offline Mode: Displaying estimated direct route path (' + (distanceM / 1000).toFixed(1) + ' km).');
          if (document.body.classList.contains('chat-open')) {
            appendBotMessage(
              '🧭 <strong>Offline Direct Vector Plotted:</strong><br>' +
              '• <strong>Destination:</strong> ' + escapeHtml(destination) + '<br>' +
              '• <strong>Estimated Distance:</strong> ' + (distanceM / 1000).toFixed(1) + ' km<br>' +
              '• <strong>Estimated Travel Time:</strong> ~' + Math.max(1, Math.round(estDurationSec / 60)) + ' min<br>' +
              '• <strong>Mode:</strong> Offline geodesic corridor navigation active.<br><br>' +
              'Click <strong>🗺️ View Route on Map</strong> to close this chat and view the active route vector.',
              [
                {
                  label: '🗺️ View Route on Map',
                  emergency: true,
                  action: function () {
                    closeAssistanceChat();
                    expandSidebar();
                    if (typeof routeLayers !== 'undefined' && routeLayers.getBounds && routeLayers.getBounds().isValid()) {
                      fitMapBoundsSafely(routeLayers.getBounds(), true);
                    }
                  }
                }
              ]
            );
          }
        } else {
          setStatus(error.message || 'Could not find routes. Please try again.');
        }
      } finally {
        if (requestId === searchRequestId) {
          searchButton.disabled = false;
          isSearching = false;
        }
      }
    }

    function handleMapClickForIncident(event) {
      toggleAddIncidentMode(false);
      const lat = event.latlng.lat;
      const lng = event.latlng.lng;

      const formDiv = document.createElement('div');
      formDiv.className = 'incident-popup';
      formDiv.innerHTML =
        '<h4>Add Live Event / Hazard</h4>' +
        '<label style="display:block;font-size:11px;margin-bottom:4px;">Type & Delay:' +
        '<select id="new-inc-type" style="width:100%;margin-top:2px;padding:3px;font-size:12px;">' +
        '<option value="flood">🌊 Flash Flood Hazard (+10m delay)</option>' +
        '<option value="closure">⛔ Road Closure / Marathon (Blocked)</option>' +
        '<option value="traffic">🚗 Heavy Congestion (3.2x delay)</option>' +
        '<option value="construction">🚧 Road Construction (+6m delay)</option>' +
        '</select>' +
        '</label>' +
        '<label style="display:block;font-size:11px;margin-bottom:6px;">Radius:' +
        '<select id="new-inc-radius" style="width:100%;margin-top:2px;padding:3px;font-size:12px;">' +
        '<option value="150">150 meters</option>' +
        '<option value="250" selected>250 meters</option>' +
        '<option value="400">400 meters</option>' +
        '</select>' +
        '</label>' +
        '<button id="save-new-inc-btn" type="button" style="width:100%;padding:6px;background:#1a73e8;color:#fff;border:0;border-radius:4px;cursor:pointer;font-weight:600;">Place Hazard</button>';

      L.popup().setLatLng(event.latlng).setContent(formDiv).openOn(map);

      setTimeout(function () {
        const saveBtn = document.getElementById('save-new-inc-btn');
        if (!saveBtn) return;
        saveBtn.addEventListener('click', function () {
          const typeSelect = document.getElementById('new-inc-type');
          const radSelect = document.getElementById('new-inc-radius');
          const type = typeSelect ? typeSelect.value : 'flood';
          const radius = radSelect ? Number(radSelect.value) : 250;

          const typeConfigs = {
            flood: { name: 'Flooded Road Hazard', icon: '🌊', color: '#d93025', penalty: 600, impassable: false },
            closure: { name: 'Emergency Road Closure', icon: '⛔', color: '#b3261e', penalty: Infinity, impassable: true },
            traffic: { name: 'Severe Traffic Jam', icon: '🚗', color: '#e37400', penalty: 480, impassable: false },
            construction: { name: 'Roadwork Hazard', icon: '🚧', color: '#f2994a', penalty: 360, impassable: false }
          };
          const config = typeConfigs[type] || typeConfigs.flood;
          liveIncidents.push({
            id: 'inc-user-' + Date.now(),
            name: config.name,
            type: type,
            icon: config.icon,
            color: config.color,
            lat: lat,
            lng: lng,
            radius: radius,
            penaltySeconds: config.penalty,
            impassable: config.impassable
          });

          map.closePopup();
          renderIncidentMarkers();
          if (destinationInput && destinationInput.value.trim()) {
            searchDestination(destinationInput.value.trim());
          }
        });
      }, 50);
    }

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      const destination = destinationInput.value.trim();
      if (destination) {
        markUserInteracted();
        searchDestination(destination);
      }
    });

    map.on('contextmenu', function (event) {
      event.originalEvent.preventDefault();
      if (isSearching) return;
      const destination = event.latlng.lat.toFixed(6) + ', ' + event.latlng.lng.toFixed(6);
      destinationInput.value = destination;
      searchDestination(destination, [event.latlng.lng, event.latlng.lat]);
    });

    destinationInput.addEventListener('input', function () {
      if (!destinationInput.value.trim()) {
        routeLayers.clearLayers();
        routesElement.replaceChildren();
        if (destinationMarker) {
          map.removeLayer(destinationMarker);
          destinationMarker = null;
        }
        setStatus('');
      }
    });

    map.on('click', function (event) {
      if (isAddingIncident) {
        handleMapClickForIncident(event);
        return;
      }
      collapseSidebar();
    });
    map.on('moveend', scheduleServiceRefresh);
    requestDeviceLocation({ setView: false, userInitiated: false, autoSearch: false });
    loadServices();

    const getCallerPlatform = function () {
      return (window.innerWidth <= 640 || ('ontouchstart' in window)) ? 'Mobile' : 'Desktop';
    };

    // Immediate startup broadcast so responder console syncs instantly on open
    broadcastUserEmergencyActivity('session_start', {
      actionDescription: 'Caller map session active',
      isSessionActive: true,
      callerPlatform: getCallerPlatform()
    });

    // Periodic heartbeat (every 3.5 seconds) so responder HUD sees live pings
    setInterval(function () {
      broadcastUserEmergencyActivity('heartbeat', {
        isSessionActive: true,
        callerPlatform: getCallerPlatform()
      });
    }, 3500);

    window.addEventListener('pagehide', function () {
      broadcastUserEmergencyActivity('session_ended', {
        actionDescription: 'Caller left map session',
        isSessionActive: false
      });
    });
    window.addEventListener('beforeunload', function () {
      broadcastUserEmergencyActivity('session_ended', {
        actionDescription: 'Caller left map session',
        isSessionActive: false
      });
    });

    // Support offline & online on localhost (127.0.0.1, [::1], *.localhost, custom ports) and production
    const isLocalhostHost = (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === '[::1]' ||
      window.location.hostname.endsWith('.localhost')
    );

    if ('serviceWorker' in navigator && (window.isSecureContext || isLocalhostHost)) {
      window.addEventListener('load', function () {
        if (window.location.protocol === 'file:') {
          console.info('Direct file:// filesystem mode active. App is operating in direct local offline storage mode.');
          return;
        }

        navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
          .then(function (reg) {
            console.log('Offline Service Worker registered on localhost/production (scope: ' + reg.scope + ')');
          })
          .catch(function () {
            return navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
          })
          .catch(function (error) {
            console.warn('Notice: Offline service worker registration handled:', error);
          });
      });
    }

    
