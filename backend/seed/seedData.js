const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: '../.env' });

const User    = require('../models/User');
const Admin   = require('../models/Admin');
const Category= require('../models/Category');
const Place   = require('../models/Place');
const Package = require('../models/Package');
const Review  = require('../models/Review');
const Cart    = require('../models/Cart');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/dayscape';

// ── Reference coordinates ─────────────────────────────────────
const REF = { lat: 6.868671, lng: 79.860689 };
const BIA = { lat: 7.180760, lng: 79.884100 }; // Bandaranaike Intl Airport

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))).toFixed(2));
}

// ── Categories ────────────────────────────────────────────────
const CATEGORIES = [
  { name:'Park / Recreational',        slug:'park-recreational',        icon:'🌳', color:'#1db87a', description:'Parks, gardens and outdoor recreational spaces' },
  { name:'Religious Site',             slug:'religious-site',            icon:'🛕', color:'#c9a84c', description:'Temples, churches, mosques and sacred places' },
  { name:'Urban Attraction / Coastal', slug:'urban-coastal',             icon:'🌊', color:'#4dc2e0', description:'Coastal promenades and urban open spaces' },
  { name:'Modern Urban Development',   slug:'modern-urban',              icon:'🏗️', color:'#a89ee8', description:'Contemporary city development projects' },
  { name:'Wildlife / Recreational',    slug:'wildlife-recreational',     icon:'🦁', color:'#e05c4e', description:'Zoos, wildlife parks and nature reserves' },
  { name:'Modern Landmark',            slug:'modern-landmark',           icon:'🗼', color:'#5ba3e8', description:'Iconic modern structures and landmarks' },
  { name:'Heritage / Cultural',        slug:'heritage-cultural',         icon:'🏛️', color:'#e8c96a', description:'Museums, heritage sites and cultural centres' },
  { name:'Nature / Eco Tourism',       slug:'nature-eco',                icon:'🦜', color:'#4caf50', description:'Wetlands, nature trails and eco-tourism' },
  { name:'Educational / Scientific',   slug:'educational-scientific',    icon:'🔭', color:'#d87ec0', description:'Science centres, planetariums and educational facilities' },
];

// ── Unsplash image URLs per theme ─────────────────────────────
const IMG = {
  park1:    'https://srilanka800.com/wp-content/uploads/2025/11/Giant-seated-Buddha-in-the-Viharamahadevi-park.jpg',
  park2:    'https://srilanka800.com/wp-content/uploads/2025/11/Viharamahadevi-Park-3.jpg',
  park3:    'https://srilanka800.com/wp-content/uploads/2025/11/Viharamahadevi-Park-45.jpg',
  park4:    'https://live.staticflickr.com/8098/8487666511_abc2c62cfb_b.jpg',
  temple1:  'https://srilanka800.com/wp-content/uploads/2025/10/Gangaramaya-Temple-2.jpg',
  temple2:  'https://srilanka800.com/wp-content/uploads/2025/10/Stone-Buddha-statue-at-Gangaramaya-Buddhist-Temple.jpg',
  temple3:  'https://srilanka800.com/wp-content/uploads/2025/10/Rows-of-buddhist-statues-in-Gangaramaya-Temple.jpg',
  temple4:  'https://srilanka800.com/wp-content/uploads/2025/10/Elephant-head-at-Gangaramaya-Buddhist-Temple-in-Colombo.jpg',
  temple5:  'https://srilanka800.com/wp-content/uploads/2025/10/Part-of-the-Buddhist-Gangaramaya-Temple-in-Colombo.jpg',
  beach1:   'https://srilanka800.com/wp-content/uploads/2025/10/Galle-Face-Green.jpg',
  beach2:   'https://srilanka800.com/wp-content/uploads/2025/10/Kites-flying-At-Galle-Face-Green.jpg',
  beach3:   'https://srilanka800.com/wp-content/uploads/2025/10/Galle-Face-Green-1.jpg',
  beach4:   'https://srilanka800.com/wp-content/uploads/2025/10/Galle-Face-Green-2.jpg',
  beach5:   'https://srilanka800.com/wp-content/uploads/2025/10/Galle-Face-Green-3.jpg',
  city1:    'https://english.news.cn/20250114/bdac8e028a6845168d54af8dcc1c16e1/20250114bdac8e028a6845168d54af8dcc1c16e1_2025011483b2379570c64421a605f498e8aa2530.jpg',
  city2:    'https://scontent.fcmb12-1.fna.fbcdn.net/v/t39.30808-6/485608395_1221728566629037_3933842358990175604_n.jpg?_nc_cat=106&ccb=1-7&_nc_sid=7b2446&_nc_ohc=Yw0acTT95f0Q7kNvwHoXv40&_nc_oc=AdqsLspMI1h2Fj9Inveolbg22O4BQb4U1lLp_fp4-js8K9bqDyiRKZLTHZMlxGp9nV2aNDfiX-uIl18kKWT-zqfz&_nc_zt=23&_nc_ht=scontent.fcmb12-1.fna&_nc_gid=SkAghM3JaJRHTL3esI49VQ&_nc_ss=7a389&oh=00_Af2edFSngSYzNjxKAwNOMYRBRwlbASjCnBANKT1s35OE-Q&oe=69ED676C',
  city3:    'https://www.pelago.com/img/products/LK-Sri%20Lanka/sunset-sailing-cruise-in-colombo-port-city/b3580964-107c-48b9-bad5-5a0c144b0aae_sunset-sailing-cruise-in-colombo-port-city.jpg',
  city4:    'https://res.cloudinary.com/djhua1jv9/image/upload/v1699250181/Kayaking_Port_City_8_44320f00c6.webp',
  city5:    'https://scontent.fcmb3-2.fna.fbcdn.net/v/t39.30808-6/611648686_1396108482212801_5101703778820814380_n.jpg?stp=dst-jpg_s960x960_tt6&_nc_cat=109&ccb=1-7&_nc_sid=e06c5d&_nc_ohc=stZZRWRADyIQ7kNvwF8dtKr&_nc_oc=AdqsIdjteiukGKoTrQ49gXKQ9U-tzcLnssfaKOjW_53zLV_Y1BXQLq5WoMCBbRWi5iUTYSON27XMkJNx1_iaJZWq&_nc_zt=23&_nc_ht=scontent.fcmb3-2.fna&_nc_gid=Y_18n5VycTwdVSsQ6DPcOQ&_nc_ss=7a389&oh=00_Af1G7s8M9hbpC1lA30Q3nPrczfFzqj8HUDIG_0WcYZPRqg&oe=69ED5FCE',
  zoo1:     'https://res.cloudinary.com/jerrick/image/upload/v1680691023/642d4f4f57fe38001dfddf0e.jpg',
  zoo2:     'https://media1.thrillophilia.com/filestore/3me5273fnwwgz3pcjbxxunfyj5di_miss.jpg?w=400&dpr=2',
  zoo3:     'https://www.holidify.com/images/cmsuploads/compressed/Jaguars_pair_20190726141429_20190726141523.jpg',
  zoo4:     'https://bmkltsly13vb.compat.objectstorage.ap-singapore-1.oraclecloud.com/cdn.sg.dailymirror.lk/assets/uploads/image_cc422cad99.jpg',
  zoo5:     'https://images.trvl-media.com/place/553248635975861457/46a508c8-0f36-44bb-8576-9f340b832a11.jpg',
  modern1:  'https://lh3.googleusercontent.com/p/AF1QipMPHSNdnNgHdnBDJRsuktgjJr-6KXfBteRo5epP=s1360-w1360-h1020-rw',
  modern2:  'https://d18slle4wlf9ku.cloudfront.net/www.cinnamonhotels.com-1302818674/cms/imagepool/68fee5fb1582c.png',
  modern3:  'https://d18slle4wlf9ku.cloudfront.net/www.cinnamonhotels.com-1302818674/cms/cache/v2/6706652953767.png/1920x1080/resize/80/57391dcfa50d9cdcf0b3ca4c9f73cbe9.jpg',
  modern4:  'https://cinnamon-life-at-city-of-dreams.hotelsincolombo.org/data/Images/OriginalPhoto/17020/1702017/1702017401/colombo-cinnamon-life-at-city-of-dreams-image-13.JPEG',
  museum1:  'https://srilanka800.com/wp-content/uploads/2025/11/Colombo-National-Museum.jpg',
  museum2:  'https://srilanka800.com/wp-content/uploads/2025/11/National-Museum-of-Colombo.jpg',
  museum3:  'https://srilanka800.com/wp-content/uploads/2025/11/National-Museum-of-Colombo-1.jpg',
  wetland1: 'https://i0.wp.com/amazinglanka.com/wp/wp-content/uploads/2017/11/DSC_3707.jpg?strip=info&w=1280&ssl=1',
  wetland2: 'https://i.pinimg.com/originals/ca/34/c2/ca34c2b2139d9fe3348f247482013153.png',
  wetland3: 'https://english.news.cn/20220203/d6f63e38139d4a6eaf76b898cc59a38d/20220203d6f63e38139d4a6eaf76b898cc59a38d_33cb023b8a-2488-4e8f-ac90-4a694afd9443.jpg.jpg',
  wetland4: 'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/2c/79/9b/28/caption.jpg?w=1400&h=-1&s=1',
  wetland5:  'https://scontent.fcmb11-3.fna.fbcdn.net/v/t39.30808-6/481826341_960182876243926_7883668704272835582_n.jpg?stp=dst-jpg_s960x960_tt6&_nc_cat=100&ccb=1-7&_nc_sid=2a1932&_nc_ohc=T0-h7NGlLNQQ7kNvwE7iiHG&_nc_oc=AdpHbJQJknVAN7wevqQjtOTL2mJunZviLfFy523r_UHOS8B60Tifeno-D8OdyNU9ZW5dORgDgIgEND7Ly8iYbI98&_nc_zt=23&_nc_ht=scontent.fcmb11-3.fna&_nc_gid=eBjSIMVwKx5FTmTMqpdPlQ&_nc_ss=7a389&oh=00_Af1mDGOrLvabR4lu2B-rs6QQKkGFD6GrjHbQiq4VN5FiYA&oe=69ED6720',
  water1:   'https://media-cdn.tripadvisor.com/media/photo-s/0e/29/09/f1/water-world-lanka.jpg',
  water2:   'https://waterworld.lk/wp-content/uploads/2025/01/R0A7231-1-scaled.jpg',
  water3:    'https://waterworld.lk/wp-content/uploads/2025/01/R0A7306edited-scaled.jpg',
  water5:    'https://waterworld.lk/wp-content/uploads/2025/01/koi-feeding-food-1568x1045.jpg',
  water4:    'https://waterworld.lk/wp-content/uploads/2025/01/R0A6831-scaled.jpg',
  tower1:   'https://srilanka800.com/wp-content/uploads/2025/10/Lotus-Tower-Colombo.jpg',
  tower2:   'https://srilanka800.com/wp-content/uploads/2025/10/Lotus-Tower.jpg',
  tower3:   'https://srilanka800.com/wp-content/uploads/2025/10/Lotus-Tower-Colombo-1.jpg',
  tower4:   'https://srilanka800.com/wp-content/uploads/2025/10/Lotus-Tower-view-2.jpg',
  tower5:   'https://srilanka800.com/wp-content/uploads/2025/10/Lotus-Tower-Colombo-2-1536x629.jpg',
  science1: 'https://images.travelandleisureasia.com/wp-content/uploads/sites/3/2023/04/28184326/Planetarium-official-website.jpg',
  science2: 'https://lh3.googleusercontent.com/pw/AM-JKLWloRCGF73Ilne6MGVgq9gkJi5QsU5Lz5kndSeCLiGdku6kdzD2RS2tfy31YXcu4Vi5pEDowYltYvIzUo_jzlaNaJFckx68cXGHZlrvoxbs8gw39myf-7lIogn0kSm0UkBLfJtdlISmtEwzPylvEeOw=w578-h386-no?authuser=2',
  science3: 'https://lh3.googleusercontent.com/pw/AM-JKLWenBobVpSmYKNhl1z20Wi7R7vK10H1F7t9KTJ7rEO27LcB38c-SsrIbEAc6_bQtFofHA3jGS0xRD8X-27BKRPGfIK41N9aqsOfUAsSeTa04UEhJyaGsMAn3a5DQ_p_bXdc2x06SLgpRzn6doJ6Ze84=w578-h304-no?authuser=2'
};

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('✓ Connected to MongoDB');

  await Promise.all([
    User.deleteMany({}), Admin.deleteMany({}), Category.deleteMany({}),
    Place.deleteMany({}), Package.deleteMany({}), Review.deleteMany({}),
    Cart.deleteMany({}),
  ]);
  console.log('✓ Cleared existing data');

  // ── Categories ──────────────────────────────────────────────
  const cats = await Category.insertMany(CATEGORIES);
  const C = {};
  cats.forEach(c => { C[c.slug] = c._id; });
  console.log('✓ Categories seeded');

  // ── Admin ────────────────────────────────────────────────────
  await Admin.create({ name:'DayScape Admin', email:'admin@dayscape.lk', password:'Admin@123' });
  console.log('✓ Admin: admin@dayscape.lk / Admin@123');

  // ── Users ────────────────────────────────────────────────────
  const [u1, u2] = await User.create([
    { name:'K. Mathusha', email:'mathusha@example.com', password:'User@123', phone:'+94771234567', nationality:'local' },
    { name:'James Wilson', email:'james@example.com',   password:'User@123', phone:'+447912345678', nationality:'foreigner' },
  ]);
  console.log('✓ Sample users created');

  // ── Places - all 11 ─────────────────────────────────────────
  const placesRaw = [
    // 1 ─ Viharamahadevi Park
    {
      name: 'Viharamahadevi Park',
      slug: 'viharamahadevi-park',
      categorySlug: 'park-recreational',
      shortDescription: 'Colombo\'s largest and most beloved public park - a lush green sanctuary in the heart of the city.',
      fullDescription: `Viharamahadevi Park (formerly Victoria Park) is the largest public park in Colombo, spanning approximately 25 acres in the cultural heart of Cinnamon Gardens. Originally laid out in the 19th century under British colonial rule, the park was renamed after Queen Viharamahadevi, a celebrated Sri Lankan queen and mother of King Dutugamunu.\n\nThe park is defined by its magnificent canopy of towering trees, manicured flower beds, ornamental ponds filled with water birds, and a prominent golden seated Buddha statue that has become one of Colombo's most photographed landmarks. The open lawns are a favourite for morning joggers, families on weekend picnics, and students from nearby universities.\n\nAt its centre is a beautiful children's play area, and around its edges stand significant civic landmarks - the National Museum, Town Hall, and the Independence Arcade. The park also hosts national celebrations including Independence Day parades and Vesak lantern displays that transform it into a magical spectacle.\n\nEarly mornings between 5:30 and 8:00 AM are ideal for visiting when the air is cool, the garden is fresh and the park teems with bird life including parakeets, mynas, and white-breasted kingfishers.`,
      address: 'Sir Marcus Fernando Mawatha (Museum Road), Colombo 07, Sri Lanka',
      lat: 6.913471, lng: 79.861433,
      openingTime: '06:00', closingTime: '18:00', closedDays: [],
      bestTimeOfDay: 'Early morning (5:30–8:00 AM) or late afternoon (4:00–7:00 PM)',
      bestSeason: 'November to April (dry season). Park is pleasant year-round.',
      estimatedDuration: '1–2 hours',
      preparationTips: ['Wear comfortable walking or running shoes','Bring water as the park can get warm midday','Early mornings are best for bird watching','A small camera or phone is perfect for the Buddha statue and ponds'],
      dressCode: 'Casual and comfortable. No special dress code.',
      safetyTips: ['Generally very safe during daylight hours','Keep an eye on children near the ponds','Secure valuables in crowded areas on weekends'],
      travelNotes: 'Well served by buses: routes 100, 101, 102, 138 stop on Museum Road. 5-minute tuk-tuk ride from Colombo 03 hotels.',
      entryType: 'free',
      tickets: { localAdult:0, localChild:0, foreignerAdult:0, foreignerChild:0 },
      coverImage: IMG.park1,
      gallery: [IMG.park1, IMG.park2, IMG.park3, IMG.park4],
      parkingAvailable: true,
      nearbyFacilities: ['National Museum (200 m)','Colombo Town Hall (500 m)','Independence Arcade (1.2 km)','Food vendors inside park','Public restrooms'],
      contactInfo: '+94 11 269 6311',
      website: '',
      rating: 4.5, reviewCount: 2, popularityScore: 92,
      tags: ['park','family','free','walking','photography','garden','colombo','birds'],
      isFeatured: true,
    },
    // 2 ─ Gangaramaya Temple
    {
      name: 'Gangaramaya Temple',
      slug: 'gangaramaya-temple',
      categorySlug: 'religious-site',
      shortDescription: 'Colombo\'s most eclectic and celebrated Buddhist temple - a blend of architecture, art, and living heritage.',
      fullDescription: `Gangaramaya Temple, situated on the western bank of Beira Lake in Slave Island, is one of the most important and visually spectacular Buddhist temples in Sri Lanka. Established in the late 19th century by Ven. Hikkaduwe Sri Sumangala Thero, it has grown over more than a century into a sprawling complex that blends Sri Lankan, Thai, Indian, and Chinese architectural influences into one extraordinary whole.\n\nThe temple complex includes several distinct areas: the main shrine room housing an ornately decorated seated Buddha, a seven-storey library, a treasury museum, a meditation hall, and the famous Seema Malaka floating meditation temple on Beira Lake (a separate structure designed by the renowned architect Geoffrey Bawa). The temple museum houses thousands of donated artifacts - ivory carvings, antique vehicles, Buddha statues in dozens of styles, rare manuscripts, elephants' tusks, and gifts from foreign governments.\n\nGangaramaya is most celebrated for the annual Navam Perahera, one of the most spectacular cultural pageants in Sri Lanka, held on the full moon of February. Hundreds of costumed elephants, dancers, drummers, and torch bearers parade through the streets of Colombo in a dazzling spectacle that draws tens of thousands of visitors.\n\nEntry for Sri Lankan nationals is free. Foreign visitors pay a museum entry fee. The temple and its grounds are active places of worship throughout the day.`,
      address: '61 Sri Jinarathana Road, Slave Island, Colombo 02, Sri Lanka',
      lat: 6.916723, lng: 79.856643,
      openingTime: '06:00', closingTime: '22:00', closedDays: [],
      bestTimeOfDay: 'Morning (6:30–9:30 AM) for peaceful worship atmosphere',
      bestSeason: 'Year-round. February for Navam Perahera festival.',
      estimatedDuration: '1–1.5 hours',
      preparationTips: ['Remove shoes before entering any shrine room','Dress modestly - shoulders and knees must be covered','Modest sarongs available at entrance for a small fee','Photography is generally allowed but be respectful inside the shrine'],
      dressCode: 'Modest clothing required. Shoulders and knees must be covered. No shorts or sleeveless tops.',
      safetyTips: ['Respectful behaviour is essential','Do not turn your back to the Buddha statues when leaving the shrine','Watch for moving vehicles near the main entrance on the busy road'],
      travelNotes: 'Located near Beira Lake. Slave Island (Maradana) railway station is a 10-minute walk. Buses 155, 170 stop nearby. Tuk-tuk readily available.',
      entryType: 'free',
      tickets: { localAdult:0, localChild:0, foreignerAdult:0, foreignerChild:0 },
      coverImage: IMG.temple1,
      gallery: [IMG.temple1, IMG.temple2, IMG.temple3, IMG.temple4, IMG.temple5],
      parkingAvailable: false,
      nearbyFacilities: ['Beira Lake (adjacent)','Seema Malaka floating temple (100 m)','Colombo City Centre mall (900 m)','Street food near entrance'],
      contactInfo: '+94 11 232 3453',
      website: 'https://web.facebook.com/GangaramayaTemple/?_rdc=1&_rdr#',
      rating: 4.8, reviewCount: 1, popularityScore: 96,
      tags: ['temple','buddhist','religious','cultural','museum','colombo','perahera','must-visit'],
      isFeatured: true,
    },
    // 3 ─ Galle Face Green
    {
      name: 'One Galle Face Green',
      slug: 'galle-face-green',
      categorySlug: 'urban-coastal',
      shortDescription: 'Colombo\'s iconic seaside promenade - where the city meets the ocean at sunset.',
      fullDescription: `Galle Face Green is a historic oceanfront urban park stretching approximately 500 metres along the Indian Ocean coastline in central Colombo. One of the oldest public recreational areas in Asia, it was first laid out in 1859 by the British Governor Sir Henry Ward and was originally used as a racing and recreational ground.\n\nToday Galle Face Green is one of Colombo's most beloved and lively public spaces. The wide open promenade facing the Indian Ocean is a social hub where locals and visitors converge for evening walks, kite flying, cricket, and to enjoy the steady ocean breeze. The green is most magical at sunset, when the sky turns gold and violet over the water.\n\nThe area is famous for its vibrant street food scene. Vendors line the promenade selling iconic local snacks including Isso Wade (crispy prawn fritters), kottu roti, fresh king coconut (thambili), corn on the cob, and boiled groundnuts. The experience of eating street food at the green while watching the sunset is considered one of the quintessential Colombo experiences.\n\nThe grand colonial Galle Face Hotel, one of Asia's finest heritage hotels (established 1864), borders the southern end of the green. The northern end connects to the modern Galle Face neighbourhood with its mix of shopping and restaurants.`,
      address: 'Galle Road, Colombo 03, Sri Lanka',
      lat: 6.923781, lng: 79.844939,
      openingTime: '00:00', closingTime: '23:59', closedDays: [],
      bestTimeOfDay: 'Evening (5:00–8:00 PM) for sunset, sea breeze and street food',
      bestSeason: 'November to April. Evenings are pleasant year-round.',
      estimatedDuration: '1–2 hours',
      preparationTips: ['Arrive around 5 PM to secure a spot for sunset','Try the famous Isso Wade (prawn vadai) - it is outstanding','Bring cash for street food vendors','A light jacket is useful November–January when sea breeze is strong'],
      dressCode: 'Casual. No restrictions.',
      safetyTips: ['Stay well back from the ocean wall during strong winds','Keep valuables close in weekend crowds','Beware of persistent vendors - a polite refusal is fine'],
      travelNotes: 'Walk from Colombo 03 hotels. Buses 100, 101 stop on Galle Road. 15-minute tuk-tuk from Colombo Fort.',
      entryType: 'free',
      tickets: { localAdult:0, localChild:0, foreignerAdult:0, foreignerChild:0 },
      coverImage: IMG.beach1,
      gallery: [IMG.beach1, IMG.beach2, IMG.beach3, IMG.beach4, IMG.beach5],
      parkingAvailable: true,
      nearbyFacilities: ['Galle Face Hotel (adjacent)','Street food vendors throughout','Galle Face Court shops','Public restrooms (limited)'],
      contactInfo: '+94 11 269 6311',
      website: '',
      rating: 4.6, reviewCount: 1, popularityScore: 91,
      tags: ['coastal','sunset','street-food','free','ocean','romantic','family','colombo','promenade'],
      isFeatured: true,
    },
    // 4 ─ Colombo Port City
    {
      name: 'Colombo Port City',
      slug: 'colombo-port-city',
      categorySlug: 'modern-urban',
      shortDescription: 'Sri Lanka\'s most ambitious urban development - a futuristic waterfront city rising from the sea.',
      fullDescription: `Colombo Port City is a landmark urban development project built on 269 hectares of land reclaimed from the Indian Ocean, adjacent to the existing Colombo city centre. It is the largest private sector investment in Sri Lanka's history, developed in partnership between the Sri Lankan government and China Harbour Engineering Company.\n\nThe development is planned as a modern mixed-use financial and commercial district, ultimately housing residential towers, luxury hotels, international business centres, retail complexes, medical facilities, and green public spaces. A dedicated Special Economic Zone operates within the area, attracting international businesses.\n\nFor visitors today, Port City offers scenic public waterfront promenades with sweeping views of the Indian Ocean and the Colombo skyline. The wide pedestrian paths along the waterfront are excellent for evening and early morning walks. On weekends, the area hosts public events, food stalls, and recreational activities.\n\nThe scale of the development is extraordinary - walking along the waterfront promenade, visitors can see the reclaimed land extending into the ocean on one side and the Colombo skyline on the other. The Lotus Tower (visible on the skyline) and Galle Face Green are within walking distance.`,
      address: 'Port City Colombo, Colombo 01, Sri Lanka',
      lat: 6.925849, lng: 79.832339,
      openingTime: '06:00', closingTime: '23:00', closedDays: [],
      bestTimeOfDay: 'Sunset (5:30–7:30 PM) for golden hour views of the ocean and city',
      bestSeason: 'November to April. Good views year-round. Weekend evenings most active.',
      estimatedDuration: '2-4 hours',
      preparationTips: ['Bring a camera - the skyline and ocean views are photogenic','Visit on a weekend when more events and stalls are present','The promenade is best explored on foot','Stay on designated public paths - development work ongoing'],
      dressCode: 'Smart casual. No specific restrictions.',
      safetyTips: ['Development work is ongoing in some areas - follow signage','Strong sea winds near the waterfront edge','Stay within public zones'],
      travelNotes: '5-minute drive from Galle Face Green. Limited public transport. Tuk-tuk or car recommended.',
      entryType: 'free',
      tickets: { localAdult:0, localChild:0, foreignerAdult:0, foreignerChild:0 },
      coverImage: IMG.city1,
      gallery: [IMG.city1, IMG.city2, IMG.city3, IMG.city4, IMG.city5],
      parkingAvailable: true,
      nearbyFacilities: ['Galle Face Green (1 km)','Colombo Fort (2 km)','Lotus Tower (1.5 km)'],
      contactInfo: '+94 11 230 5000',
      website: 'https://www.portcitycolombo.lk',
      rating: 3.9, reviewCount: 0, popularityScore: 72,
      tags: ['modern','waterfront','development','free','promenade','future','colombo','ocean'],
      isFeatured: false,
    },
    // 5 ─ Dehiwala Zoo
    {
      name: 'Dehiwala Zoological Gardens',
      slug: 'dehiwala-zoological-gardens',
      categorySlug: 'wildlife-recreational',
      shortDescription: 'Sri Lanka\'s national zoo - home to 3,000+ animals across 350 species, and the closest major attraction to our reference location.',
      fullDescription: `The Dehiwala Zoological Gardens, established in 1936, is the national zoological park of Sri Lanka and one of the most visited family attractions near Colombo. Spread across 23 lush acres in Dehiwala - just 2.6 km from our reference location at 38 Rajasinghe Road - it is home to more than 3,000 animals representing over 350 species from around the world.\n\nHighlights of the zoo include a large colony of Asian elephants, Sri Lankan leopards, Bengal tigers, lions, chimpanzees, orangutans, giant tortoises, Nile crocodiles, and an extensive collection of reptiles, birds, and marine life in the on-site aquarium. The zoo is particularly renowned for its daily elephant show, held at 3:15 PM, which has been a Colombo institution for decades.\n\nThe grounds are beautifully landscaped with mature trees, walking paths, and picnic areas, making it a pleasant outing even in the tropical heat. The zoo plays an important role in conservation and wildlife education, operating breeding programmes for endangered species including the Sri Lankan leopard and the fishing cat.\n\nThe zoo is operated by the Department of National Zoological Gardens of Sri Lanka under the Ministry of Environment. Ticket prices are subsidised for local visitors.`,
      address: 'Anagarika Dharmapala Mawatha, Dehiwala, Sri Lanka',
      lat: 6.856773, lng: 79.874388,
      openingTime: '08:30', closingTime: '17:00', closedDays: [],
      bestTimeOfDay: 'Morning (8:30–11:00 AM) or after 2:30 PM for the elephant show',
      bestSeason: 'Year-round. Avoid midday in April and May (hottest months). School holidays are busiest.',
      estimatedDuration: '3–4 hours',
      preparationTips: ['Arrive before 9 AM to avoid crowds and midday heat','Plan around the 4:15 PM elephant show','Bring water and light snacks - food stalls are available inside','Wear comfortable walking shoes and light clothing'],
      dressCode: 'Casual and comfortable. Light breathable clothing for tropical heat.',
      safetyTips: ['Stay behind all designated barriers at animal enclosures','Do not feed or attempt to touch animals','Keep children within sight at all times','Do not use flash photography near sensitive animals'],
      travelNotes: 'Closest attraction to reference location (2.6 km). Buses 100 and 101 (Galle Road) to Dehiwala stop. Dehiwala train station is a 5-minute walk.',
      entryType: 'paid',
      tickets: { localAdult:500, localChild:250, foreignerAdult:5000, foreignerChild:3000 },
      coverImage: IMG.zoo1,
      gallery: [IMG.zoo1, IMG.zoo2, IMG.zoo3, IMG.zoo4, IMG.zoo5],
      parkingAvailable: true,
      nearbyFacilities: ['Dehiwala Railway Station (500 m)','Food stalls inside zoo','Gift shop inside','On-site aquarium'],
      contactInfo: '+94 11 271 2751',
      website: 'https://tickets.nationalzoo.gov.lk/',
      rating: 4.3, reviewCount: 0, popularityScore: 89,
      tags: ['zoo','animals','family','educational','children','elephants','conservation','dehiwala'],
      isFeatured: true,
    },
    // 6 ─ Cinnamon Life
    {
      name: 'Cinnamon Life at City of Dreams',
      slug: 'cinnamon-life-city-of-dreams',
      categorySlug: 'modern-landmark',
      shortDescription: 'Sri Lanka\'s largest integrated resort - luxury, entertainment, and dining in the heart of Colombo.',
      fullDescription: `Cinnamon Life at City of Dreams is Sri Lanka's most ambitious and largest integrated resort development, located on a prime 4.5-acre site in Colombo 02. Developed by John Keells Holdings in partnership with Melco Resorts & Entertainment, it represents an investment of over USD 800 million and is among the largest private sector projects in South Asian hospitality.\n\nThe complex brings together multiple luxury offerings under one roof: the Cinnamon Life Hotel (a five-star property with over 300 rooms), branded luxury residences, the City of Dreams Casino, a state-of-the-art international conference and banquet centre, multiple premium restaurants covering diverse world cuisines, high-end retail, a spa and wellness centre, and a rooftop sky bar with panoramic views of Colombo.\n\nFor visitors who are not hotel guests, the dining, entertainment, and retail areas are accessible. The complex is a favourite venue for international conferences, high-profile events, and social gatherings. The sky bar and several of the restaurant terraces offer spectacular elevated views of Colombo and Beira Lake.\n\nDining options range from fine dining to casual, with restaurants serving Sri Lankan, Chinese, Japanese, and European cuisine. Reservations are strongly recommended for premium dining venues, particularly on weekends.`,
      address: '1A Sir James Peiris Mawatha, Colombo 02, Sri Lanka',
      lat: 6.924974, lng: 79.848912,
      openingTime: '10:00', closingTime: '22:00', closedDays: [],
      bestTimeOfDay: 'Evening (7:00–10:00 PM) for dining and sky bar views',
      bestSeason: 'Year-round.',
      estimatedDuration: '2–4 hours',
      preparationTips: ['Reserve restaurants in advance - popular venues are often booked','Smart casual or formal dress for premium dining venues','Check events calendar for concerts and business summits','Sky bar may have a minimum spend requirement'],
      dressCode: 'Smart casual minimum. Formal attire for premium restaurants.',
      safetyTips: ['Follow all resort security guidelines','Casino is 21+ - age verification required'],
      travelNotes: '10-minute drive from Colombo Fort. Ample valet and self-parking. Slave Island station 1 km away.',
      entryType: 'free',
      tickets: { localAdult:0, localChild:0, foreignerAdult:0, foreignerChild:0 },
      coverImage: IMG.modern1,
      gallery: [IMG.modern1, IMG.modern2, IMG.modern3, IMG.modern4],
      parkingAvailable: true,
      nearbyFacilities: ['Beira Lake (500 m)','Colombo City Centre mall (1.2 km)','Slave Island station (1 km)','Gangaramaya Temple (800 m)'],
      contactInfo: '+94 11 249 1000',
      website: 'https://www.cinnamonhotels.com/cinnamonlifecolombo',
      rating: 4.1, reviewCount: 0, popularityScore: 76,
      tags: ['luxury','entertainment','hotel','dining','modern','resort','colombo','casino'],
      isFeatured: false,
    },
    // 7 ─ National Museum
    {
      name: 'National Museum Colombo',
      slug: 'national-museum-colombo',
      categorySlug: 'heritage-cultural',
      shortDescription: 'Sri Lanka\'s premier national museum - 3,000 years of history, royal regalia, and cultural treasures.',
      fullDescription: `The National Museum of Colombo, established on 1 January 1877 under Governor Sir William Henry Gregory, is the largest and most important museum in Sri Lanka. Housed in a grand white colonial building surrounded by the gardens of Viharamahadevi Park, the museum is the country's most significant repository of historical artifacts and cultural heritage.\n\nThe museum's 24 galleries across three floors present an extraordinary journey through Sri Lankan civilisation, from prehistoric times to the post-colonial era. The centrepiece of the collection is the royal regalia of the last king of Kandy, including the golden throne, jewelled crown, and ceremonial sword - surrendered when the Kandyan Kingdom fell to the British in 1815. Other outstanding displays include an unparalleled collection of ancient Sinhalese sculpture, traditional masks used in ritual Kolam dances, ancient coins, weaponry, traditional costumes, and natural history specimens.\n\nThe museum maintains a specialist library of rare Sinhala, Pali, and Sanskrit manuscripts, and an extensive archive of historical photographs. The gift shop offers quality reproductions and Sri Lankan crafts.\n\nIMPORTANT: The museum is closed on Fridays and on all public Poya (full moon) holidays. Always check the calendar before visiting.`,
      address: 'Sir Marcus Fernando Mawatha, Colombo 07, Sri Lanka',
      lat: 6.910002, lng: 79.860909,
      openingTime: '09:00', closingTime: '17:00', closedDays: ['Monday', 'Poya days'],
      bestTimeOfDay: 'Morning (9:00 AM–12:00 PM) before afternoon crowds',
      bestSeason: 'Year-round. Avoid Poya and public holidays (closed).',
      estimatedDuration: '2–3 hours',
      preparationTips: ['Check Poya holiday calendar - museum CLOSED on full moon days and Fridays','Audio guide available for hire at reception desk','Photography: allowed in most galleries but check signs','Combine with Viharamahadevi Park next door'],
      dressCode: 'Smart casual. Modest dress is respectful.',
      safetyTips: ['Do not touch exhibits','Photography without flash only in permitted areas'],
      travelNotes: 'Adjacent to Viharamahadevi Park. Buses 100, 102, 138 on Museum Road.',
      entryType: 'paid',
      tickets: { localAdult:100, localChild:50, foreignerAdult:1500, foreignerChild:750 },
      coverImage: IMG.museum1,
      gallery: [IMG.museum1, IMG.museum2, IMG.museum3, IMG.museum4],
      parkingAvailable: true,
      nearbyFacilities: ['Viharamahadevi Park (adjacent)','Dutch Period Museum (3 km)','Colombo Town Hall (500 m)','Café inside museum grounds'],
      contactInfo: '+94 11 269 4767',
      website: 'http://www.museum.gov.lk',
      rating: 4.4, reviewCount: 0, popularityScore: 82,
      tags: ['museum','heritage','cultural','history','art','colonial','must-visit','kandyan'],
      isFeatured: true,
    },
    // 8 ─ Beddagana Wetland
    {
      name: 'Beddagana Wetland Park',
      slug: 'beddagana-wetland-park',
      categorySlug: 'nature-eco',
      shortDescription: 'Colombo\'s hidden ecological gem - a Ramsar-designated wetland sanctuary perfect for bird watching.',
      fullDescription: `Beddagana Wetland Park is a remarkable protected urban wetland located in Sri Jayawardenepura Kotte, on the eastern fringe of Colombo. Covering approximately 17 hectares, it has been designated as a Ramsar Wetland of International Importance - recognising its exceptional ecological significance in providing habitat for over 100 bird species and serving as a vital water catchment and filtration zone for the greater Colombo area.\n\nManaged by the Sri Lanka Land Reclamation and Development Corporation (SLLRDC), the park features a well-maintained network of elevated boardwalks and footpaths that wind through diverse wetland habitats including open water bodies, reed beds, mangrove patches, and marshy grassland. The park is a paradise for bird watchers, with resident and migratory species including purple herons, painted storks, lesser whistling ducks, Eurasian coots, several species of kingfisher, and the rare purple-faced leaf monkey visible in the tree canopy.\n\nThe park is a hidden gem within the urban landscape, providing a genuinely tranquil escape from the city noise just minutes from the Parliament complex. It is one of the few places in and around Colombo where you can walk through genuinely wild-feeling natural habitat. Guided tours are occasionally available; contact the park in advance.\n\nEarly mornings (6:00–8:00 AM) offer the best bird activity and the most pleasant temperatures. The park can become quite warm and humid by midday.`,
      address: 'Beddagana Road, Sri Jayawardenepura Kotte, Colombo, Sri Lanka',
      lat: 6.890586, lng: 79.906600,
      openingTime: '06:00', closingTime: '18:00', closedDays: [],
      bestTimeOfDay: 'Early morning (6:00–9:00 AM) for birds and cooler temperatures',
      bestSeason: 'October to March for migratory bird species. Year-round otherwise.',
      estimatedDuration: '1.5–2.5 hours',
      preparationTips: ['Bring binoculars - essential for bird watching','Wear muted, dark colours to avoid startling wildlife','Apply insect repellent before entering','Carry your own water - no vendors inside the park','Call ahead to arrange a guided tour'],
      dressCode: 'Casual comfortable clothing. Muted colours preferred.',
      safetyTips: ['Stay on the boardwalks and designated paths at all times','Do not disturb nesting birds or approach nests','Boardwalks may be slippery after rain - walk carefully'],
      travelNotes: '8.2 km from reference location via Nawala Road. Best reached by tuk-tuk or car. Limited public transport.',
      entryType: 'paid',
      tickets: { localAdult:100, localChild:50, foreignerAdult:1000, foreignerChild:500 },
      coverImage: IMG.wetland1,
      gallery: [IMG.wetland1, IMG.wetland2, IMG.wetland3, IMG.wetland4, IMG.wetland5],
      parkingAvailable: true,
      nearbyFacilities: ['Parliament of Sri Lanka (2 km)','Diyawanna Lake (adjacent)'],
      contactInfo: '+94 11 286 5607',
      website: 'https://web.facebook.com/beddaganawetlandpark/?_rdc=1&_rdr#',
      rating: 4.7, reviewCount: 0, popularityScore: 74,
      tags: ['wetland','birdwatching','nature','eco-tourism','free','photography','peaceful','ramsar'],
      isFeatured: false,
    },
    // 9 ─ Water World Lanka
    {
      name: 'Kelaniya Water World Lanka',
      slug: 'kelaniya-water-world-lanka',
      categorySlug: 'park-recreational',
      shortDescription: 'Sri Lanka\'s favourite family water park - a full day of thrills, pools, and slides.',
      fullDescription: `Kelaniya Water World Lanka is one of the most popular family entertainment destinations near Colombo, located approximately 19 km from our reference point in Kelaniya, Gampaha District. The park is a full-service water theme park offering a wide range of water attractions spread across well-maintained tropical grounds.\n\nThe park features multiple water slides of varying intensity and height - from gentle family slides to high-speed thrill rides - as well as a large wave pool that generates rolling ocean-like waves, a lazy river ride for leisurely floating, dedicated shallow splash zones for young children, and relaxation areas with sun loungers around the pool decks. Changing rooms, locker facilities, shower areas, and multiple food outlets serving Sri Lankan and international snacks are available on site.\n\nWater World Lanka is particularly popular during school holidays, Avurudu (Sinhala and Tamil New Year in April), and weekends throughout the year. Visiting on a weekday significantly reduces queuing times. Online ticket booking is available and offers a discount over gate prices.\n\nThe park is well-fenced and monitored by trained lifeguards at all major water attractions. Children under a certain height may be restricted from the larger slides - check the park website for current height requirements.`,
      address: 'Peliyagoda Road, Kelaniya, Gampaha District, Sri Lanka',
      lat: 6.944167, lng: 79.942406,
      openingTime: '09:30', closingTime: '17:00', closedDays: ['Poyadays'],
      bestTimeOfDay: 'Arrive at 9 AM opening to maximise the day',
      bestSeason: 'March to October (warmer months ideal for outdoor water activities). Closed some Mondays.',
      estimatedDuration: '4–6 hours (full day recommended)',
      preparationTips: ['Book tickets online for discounts - gate prices are higher','Bring swimwear, a towel, and plenty of sunscreen','Lockers available for rent - bring a padlock or rent one','Pack extra clothes and a dry bag for valuables','Bring cash for food and locker rental'],
      dressCode: 'Swimwear required inside water areas. No jeans, cut-offs, or street clothes in pools.',
      safetyTips: ['Follow all lifeguard instructions at all times','Non-swimmers must use designated floatation devices','Do not use slides if you have recent injuries or heart conditions','Apply and reapply waterproof sunscreen'],
      travelNotes: '19 km from reference location - take the Kelani Bridge route via Peliyagoda. Best by car or taxi. Return trip by bus is possible from Peliyagoda junction.',
      entryType: 'paid',
      tickets: { localAdult:1200, localChild:700, foreignerAdult:3500, foreignerChild:2000 },
      coverImage: IMG.water1,
      gallery: [IMG.water1, IMG.water2, IMG.water3, IMG.water4, IMG.water5],
      parkingAvailable: true,
      nearbyFacilities: ['Kelaniya Raja Maha Vihara (3 km)','Food stalls at park entrance','Kelani River (adjacent)'],
      contactInfo: '+94 11 290 0900',
      website: 'https://waterworld.lk/',
      rating: 4.2, reviewCount: 0, popularityScore: 80,
      tags: ['water-park','family','fun','slides','swimming','day-trip','children','thrill'],
      isFeatured: false,
    },
    // 10 ─ Lotus Tower
    {
      name: 'Colombo Lotus Tower',
      slug: 'colombo-lotus-tower',
      categorySlug: 'modern-landmark',
      shortDescription: 'South Asia\'s tallest tower - iconic, illuminated, and offering 360° panoramic views of Colombo.',
      fullDescription: `The Colombo Lotus Tower (Sinhala: කොළඹ නෙළුම් කුළුණ) is the tallest self-supported structure in South Asia, rising 350.5 metres above the city. Completed after many years of construction and officially opened in September 2022, it has rapidly become one of Sri Lanka's most recognised modern landmarks and a symbol of national pride.\n\nDesigned in the shape of a blooming lotus flower - one of the most sacred symbols in Buddhism and Sri Lankan culture - the tower is an extraordinary feat of contemporary engineering. Its distinctive petal-shaped crown is equipped with sophisticated LED lighting systems that produce spectacular colour-changing light displays at night, visible from many kilometres across Colombo.\n\nThe tower serves dual purposes: as the primary telecommunications transmission hub for Sri Lanka Broadcasting Corporation and other national broadcasters, and as a premium tourism and commercial destination. For visitors, the tower offers a domed observation deck on the 17th and 18th floors providing breathtaking 360-degree panoramic views over Colombo, the Indian Ocean, the hills to the east, and on clear days, features as far as Galle in the south.\n\nThe tower also features a revolving restaurant (advance reservations essential), a banquet hall, a dedicated tourism exhibition floor with interactive displays about Sri Lanka, and a souvenir shop. The outdoor viewing terrace allows visitors to experience the height and views directly.`,
      address: 'Bauddhaloka Mawatha, Slave Island, Colombo 02, Sri Lanka',
      lat: 6.927097, lng: 79.858324,
      openingTime: '09:00', closingTime: '21:00', closedDays: [],
      bestTimeOfDay: 'Sunset (5:30–7:00 PM) for dual day/evening views. Evening for illuminated city.',
      bestSeason: 'Year-round. Visibility best November to April.',
      estimatedDuration: '1.5–2.5 hours',
      preparationTips: ['Book observation deck tickets online in advance - queues can be long on weekends','Visit just before sunset for both daylight and evening city views','The revolving restaurant requires advance booking','Last entry is approximately 9:00 PM','Clear days offer views to Galle and Adam\'s Peak'],
      dressCode: 'Smart casual for restaurant and main floors. Casual acceptable for observation deck.',
      safetyTips: ['Fully enclosed and climate-controlled observation deck','Do not attempt to climb external structures','Follow staff instructions in all areas'],
      travelNotes: 'Located in Slave Island near Beira Lake. Slave Island railway station (500 m). Tuk-tuk from Colombo 03 in 15 minutes.',
      entryType: 'paid',
      tickets: { localAdult:750, localChild:400, foreignerAdult:7000, foreignerChild:4000 },
      coverImage: IMG.tower1,
      gallery: [IMG.tower1, IMG.tower2, IMG.tower3, IMG.tower4, IMG.tower5],
      parkingAvailable: true,
      nearbyFacilities: ['Beira Lake (500 m)','Gangaramaya Temple (1.5 km)','Revolving restaurant inside tower','Gift shop inside'],
      contactInfo: '+94 11 243 6500',
      website: 'https://www.colombolotustower.lk',
      rating: 4.6, reviewCount: 0, popularityScore: 94,
      tags: ['tower','views','panoramic','modern','landmark','photography','must-visit','night','south-asia'],
      isFeatured: true,
    },
    // 11 ─ Sri Lanka Planetarium
    {
      name: 'Sri Lanka Planetarium',
      slug: 'sri-lanka-planetarium',
      categorySlug: 'educational-scientific',
      shortDescription: 'Colombo\'s window to the universe - immersive sky shows and astronomy education for all ages.',
      fullDescription: `The Sri Lanka Planetarium, located adjacent to Viharamahadevi Park in Colombo 07, is the premier astronomy education centre in Sri Lanka and one of the oldest planetariums in South Asia. Established in 1965 under the Ministry of Education, it has served generations of Sri Lankan students, families, and astronomy enthusiasts.\n\nThe planetarium's main feature is its domed projection theatre, equipped with a state-of-the-art digital projection system capable of simulating the night sky in extraordinary detail. Audiences recline in angled seats and look up at the dome as the sky display unfolds, covering topics ranging from the phases of the moon and seasonal constellations visible from Sri Lanka, to journeys through the solar system, the life cycle of stars, and deep space exploration including black holes, nebulae, and distant galaxies.\n\nRegular sky shows (typically 45–60 minutes each) are scheduled throughout the day and are held in Sinhala, Tamil, and English. The planetarium also hosts telescope observation sessions on clear evenings, science workshops for school groups, educational exhibitions in the foyer and surrounding grounds, and guest lecture events by astronomers and scientists.\n\nThe planetarium sits within the cultural precinct of Colombo 07, making it easy to combine with a visit to Viharamahadevi Park (directly adjacent) and the National Museum (200 metres away).`,
      address: 'Bauddhaloka Mawatha, Colombo 07, Sri Lanka',
      lat: 6.900693, lng: 79.862857,
      openingTime: '08:30', closingTime: '16:30', closedDays: ['Monday', 'Sunday', 'Poya days'],
      bestTimeOfDay: 'Morning shows at 9:30 AM or 11:00 AM; afternoon shows at 2:00 PM and 3:30 PM',
      bestSeason: 'Year-round. Busier during school term time; quieter during school holidays.',
      estimatedDuration: '1–2 hours (including 45–60 min sky show)',
      preparationTips: ['Check show schedule before visiting - shows run at fixed times and cannot be joined midway','Book in advance for school groups or large parties','Combine with Viharamahadevi Park and National Museum for a full day in Colombo 07','Arrive 15 minutes before show time'],
      dressCode: 'Casual.',
      safetyTips: ['Remain seated during dome shows','No flash photography inside the dome - it disrupts the projection'],
      travelNotes: '4.8 km from reference location. Adjacent to Viharamahadevi Park. Buses 100, 138 on Museum Road.',
      entryType: 'paid',
      tickets: { localAdult:200, localChild:75, foreignerAdult:500, foreignerChild:400 },
      coverImage: IMG.science1,
      gallery: [IMG.science1, IMG.science2, IMG.science3],
      parkingAvailable: true,
      nearbyFacilities: ['Viharamahadevi Park (adjacent)','National Museum (200 m)','Colombo Town Hall (600 m)'],
      contactInfo: '+94 11 269 5757',
      website: '',
      rating: 4.3, reviewCount: 0, popularityScore: 69,
      tags: ['science','astronomy','education','children','planetarium','sky-show','family','museum'],
      isFeatured: false,
    },
  ];

  // ── Enrich with calculated distances and insert ──────────────
  const catLookup = {};
  cats.forEach(c => { catLookup[c.slug] = c._id; });

  const placeDocs = placesRaw.map(p => {
    const { categorySlug, ...rest } = p;
    return {
      ...rest,
      category: catLookup[categorySlug],
      distanceFromReference: haversine(REF.lat, REF.lng, p.lat, p.lng),
      distanceFromAirport:   haversine(BIA.lat, BIA.lng, p.lat, p.lng),
    };
  });

  const places = await Place.insertMany(placeDocs);
  console.log(`✓ ${places.length} places seeded`);

  const PM = {}; // place map slug → _id
  places.forEach(p => { PM[p.slug] = p._id; });

  // ── Sample Reviews ───────────────────────────────────────────
  await Review.insertMany([
    { user: u1._id, place: PM['viharamahadevi-park'],     rating:5, title:'Perfect morning escape', comment:'I jog here every weekend. The golden Buddha is stunning at sunrise and the park is always well-kept. Highly recommended for families and joggers alike.', visitDate: new Date('2026-02-15'), isApproved: true },
    { user: u2._id, place: PM['viharamahadevi-park'],     rating:4, title:'Lovely park, weekend crowds', comment:'Beautiful park with nice gardens. A bit crowded on Sunday mornings but still enjoyable. The pond area with lily pads is particularly picturesque.', visitDate: new Date('2026-03-02'), isApproved: true },
    { user: u1._id, place: PM['gangaramaya-temple'],       rating:5, title:'An unforgettable experience', comment:'The museum inside is absolutely extraordinary - artifacts from all over the world. The architectural mix of styles is unique. A must-visit for any Colombo trip.', visitDate: new Date('2026-01-20'), isApproved: true },
    { user: u2._id, place: PM['galle-face-green'],         rating:5, title:'Best sunset in Colombo', comment:'The Isso Wade street food is worth every rupee. The ocean breeze at sunset makes this the most romantic spot in the city. We stayed for two hours.', visitDate: new Date('2026-02-28'), isApproved: true },
  ]);
  await Place.findByIdAndUpdate(PM['viharamahadevi-park'], { rating:4.5, reviewCount:2 });
  await Place.findByIdAndUpdate(PM['gangaramaya-temple'], { rating:5.0, reviewCount:1 });
  await Place.findByIdAndUpdate(PM['galle-face-green'],   { rating:5.0, reviewCount:1 });
  console.log('✓ Reviews seeded');

  // ── Packages ─────────────────────────────────────────────────
  await Package.insertMany([
    {
      name: 'Colombo Cultural Heritage Day',
      description: 'Immerse yourself in Colombo\'s rich cultural and historical heritage. Visit the National Museum, the eclectic Gangaramaya Temple, and relax in Viharamahadevi Park. Ideal for history lovers and first-time visitors.',
      places: [PM['national-museum-colombo'], PM['gangaramaya-temple'], PM['viharamahadevi-park']],
      price:4500, currency:'LKR', duration:'1 Day', maxPeople:15,
      includes:['English-speaking guide','Museum entry fees','Temple donation fee','Park refreshments','Transport between venues'],
      excludes:['Personal meals','Photography permits','Souvenirs'],
      coverImage:IMG.museum1, rating:4.7, category:'cultural', isActive:true, isFeatured:true, discount:10, originalPrice:5000,
    },
    {
      name: 'Colombo Coastal Sunset Tour',
      description: 'Experience Colombo\'s spectacular coastline. Begin at the Lotus Tower for 360° panoramic views, stroll along Galle Face Green at sunset with famous street food, then explore the futuristic Port City waterfront.',
      places: [PM['colombo-lotus-tower'], PM['galle-face-green'], PM['colombo-port-city']],
      price:5500, currency:'LKR', duration:'Half Day (Afternoon/Evening)', maxPeople:12,
      includes:['Lotus Tower observation deck tickets','Evening street food tasting at Galle Face','Private transport','Professional guide'],
      excludes:['Revolving restaurant booking','Personal spending'],
      coverImage:IMG.tower1, rating:4.8, category:'scenic', isActive:true, isFeatured:true, discount:0, originalPrice:5500,
    },
    {
      name: 'Family Adventure Package',
      description: 'A packed family day out! Watch the famous elephant show at Dehiwala Zoo, cool off with thrilling slides at Water World Lanka, and finish with an evening at Galle Face Green.',
      places: [PM['dehiwala-zoological-gardens'], PM['kelaniya-water-world-lanka'], PM['galle-face-green']],
      price:8000, currency:'LKR', duration:'Full Day', maxPeople:20,
      includes:['Zoo entry (2 adults + 2 children)','Water World Lanka tickets','Return transport','Lunch at water park','Elephant show access'],
      excludes:['Locker rental','Extra children tickets','Personal spending'],
      coverImage:IMG.zoo1, rating:4.5, category:'family', isActive:true, isFeatured:true, discount:15, originalPrice:9400,
    },
    {
      name: 'Nature & Eco Explorer',
      description: 'Discover Colombo\'s hidden natural gems. Sunrise bird watching at the Ramsar-listed Beddagana Wetland, a peaceful stroll through Viharamahadevi Park, and a sky show at the Sri Lanka Planetarium.',
      places: [PM['beddagana-wetland-park'], PM['viharamahadevi-park'], PM['sri-lanka-planetarium']],
      price:3500, currency:'LKR', duration:'1 Day', maxPeople:10,
      includes:['Wetland guided nature walk','Planetarium sky show tickets','Binoculars provided','Nature guide','Transport'],
      excludes:['Personal meals','Photography equipment'],
      coverImage:IMG.wetland1, rating:4.6, category:'nature', isActive:true, isFeatured:false, discount:0, originalPrice:3500,
    },
    {
      name: 'Modern Colombo VIP Experience',
      description: 'Experience the very best of modern Colombo in style. Visit Cinnamon Life, enjoy a panoramic dinner at the Lotus Tower, and explore the futuristic Port City waterfront at dusk.',
      places: [PM['cinnamon-life-city-of-dreams'], PM['colombo-lotus-tower'], PM['colombo-port-city']],
      price:12000, currency:'LKR', duration:'Evening Experience', maxPeople:8,
      includes:['VIP transport','Lotus Tower observation deck','Cinnamon Life dinner reservation','Personal concierge','Professional photography session'],
      excludes:['Food and beverage bills','Casino entry'],
      coverImage:IMG.modern1, rating:4.4, category:'luxury', isActive:true, isFeatured:true, discount:0, originalPrice:12000,
    },
    {
      name: 'Complete Colombo Day Pass',
      description: 'The ultimate Colombo experience - five iconic stops in one comprehensive guided day tour. Perfect for first-time visitors who want to see the essential highlights.',
      places: [PM['viharamahadevi-park'], PM['gangaramaya-temple'], PM['galle-face-green'], PM['national-museum-colombo'], PM['colombo-lotus-tower']],
      price:9500, currency:'LKR', duration:'Full Day', maxPeople:15,
      includes:['All entry tickets','Lunch','English-speaking guide','Air-conditioned transport','Complimentary water'],
      excludes:['Personal shopping','Optional restaurant meals','Gratuities'],
      coverImage:IMG.city1, rating:4.8, category:'general', isActive:true, isFeatured:true, discount:20, originalPrice:11900,
    },
  ]);
  console.log('✓ Packages seeded');

  console.log('\n══════════════════════════════════════');
  console.log('  DAYSCAPE v2 SEED COMPLETE ✓');
  console.log('══════════════════════════════════════');
  console.log('  Admin:  admin@dayscape.lk  /  Admin@123');
  console.log('  User 1: mathusha@example.com  /  User@123');
  console.log('  User 2: james@example.com  /  User@123');
  console.log('══════════════════════════════════════\n');
  console.log('DATA ACCURACY NOTES:');
  console.log('  - Coordinates: accurate GPS');
  console.log('  - Distances: calculated via Haversine formula');
  console.log('  - Opening times: based on public information');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
