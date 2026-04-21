export const parseNaturalLanguageQuery = (query) => {
  const filters = {
    gender: null,
    age_group: null,
    country_id: null,
    min_age: null,
    max_age: null,
  };

  const lowerQuery = query.toLowerCase().trim();

  // Gender parsing
  if (lowerQuery.includes('male')) {
    filters.gender = 'male';
  } else if (lowerQuery.includes('female')) {
    filters.gender = 'female';
  }

  // Age group parsing
  if (lowerQuery.includes('teenager') || lowerQuery.includes('teens')) {
    filters.age_group = 'teenager';
  } else if (lowerQuery.includes('child') || lowerQuery.includes('children')) {
    filters.age_group = 'child';
  } else if (lowerQuery.includes('senior') || lowerQuery.includes('elderly')) {
    filters.age_group = 'senior';
  } else if (lowerQuery.includes('adult') || lowerQuery.includes('adults')) {
    filters.age_group = 'adult';
  }

  // Age-related parsing
  if (lowerQuery.includes('young')) {
    filters.min_age = 16;
    filters.max_age = 24;
  }

  // Number extraction for specific ages
  const ageMatch = lowerQuery.match(/(\d+)\s*(?:years?|yrs?|old)?/);
  if (ageMatch) {
    const age = parseInt(ageMatch[1]);
    if (lowerQuery.includes('above') || lowerQuery.includes('older') || lowerQuery.includes('over')) {
      filters.min_age = age;
    } else if (lowerQuery.includes('below') || lowerQuery.includes('younger') || lowerQuery.includes('under')) {
      filters.max_age = age;
    }
  }

  // Country parsing (mapping common country names to ISO codes)
  const countryMap = {
    'nigeria': 'NG',
    'nigerians': 'NG',
    'kenya': 'KE',
    'kenyans': 'KE',
    'ghana': 'GH',
    'ghanaians': 'GH',
    'south africa': 'ZA',
    'african': 'ZA',
    'angola': 'AO',
    'angolans': 'AO',
    'benin': 'BJ',
    'beninese': 'BJ',
    'cameroon': 'CM',
    'cameroonians': 'CM',
    'egypt': 'EG',
    'egyptians': 'EG',
    'ethiopia': 'ET',
    'ethiopians': 'ET',
    'ivory coast': 'CI',
    'côte d\'ivoire': 'CI',
    'tanzania': 'TZ',
    'tanzanians': 'TZ',
    'uganda': 'UG',
    'ugandans': 'UG',
    'zambia': 'ZM',
    'zambians': 'ZM',
    'zimbabwe': 'ZW',
    'zimbabweans': 'ZW',
  };

  for (const [country, code] of Object.entries(countryMap)) {
    if (lowerQuery.includes(country)) {
      filters.country_id = code;
      break;
    }
  }

  // Check if query is interpretable
  const hasValidFilters = Object.values(filters).some(v => v !== null);
  
  if (!hasValidFilters) {
    return null;
  }

  // Remove null values
  Object.keys(filters).forEach(key => filters[key] === null && delete filters[key]);

  return filters;
};