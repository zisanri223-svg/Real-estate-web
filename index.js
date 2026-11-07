require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const adminRouter = require('./admin');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// --- MONGODB CONNECTION (Serverless Optimized) ---
let cachedDb = global.mongoose;
if (!cachedDb) cachedDb = global.mongoose = { conn: null, promise: null };

async function connectDB() {
    if (cachedDb.conn) return cachedDb.conn;
    if (!cachedDb.promise) {
        cachedDb.promise = mongoose.connect(process.env.MONGODB_URI, { 
            serverSelectionTimeoutMS: 5000 
        }).then(m => m);
    }
    cachedDb.conn = await cachedDb.promise;
    return cachedDb.conn;
}

// --- DATABASE MODELS ---
const propertySchema = new mongoose.Schema({
    title: String, description: String, district: { type: String, default: 'Kishoreganj' },
    upazila: String, union: String, village: String,
    landSize: Number, landUnit: String, sizeInDecimal: Number,
    price: Number, landCategory: String, roadAccess: String,
    images: [String], coverImage: String, videoUrl: String, mapUrl: String,
    status: { type: String, default: 'Available' }, isFeatured: { type: Boolean, default: false }
}, { timestamps: true });

const applicationSchema = new mongoose.Schema({
    sellerName: String, phone: String, whatsapp: String,
    district: { type: String, default: 'Kishoreganj' },
    upazila: String, union: String, village: String,
    landSize: Number, landUnit: String, sizeInDecimal: Number,
    expectedPrice: Number, landCategory: String, roadAccess: String,
    description: String, images: [String],
    status: { type: String, default: 'Pending' } // Pending, Approved, Rejected
}, { timestamps: true });

const videoSchema = new mongoose.Schema({
    title: String, description: String, url: String,
    upazila: String, village: String, thumbnail: String, isFeatured: Boolean
}, { timestamps: true });

const Models = {
    Property: mongoose.models.Property || mongoose.model('Property', propertySchema),
    SellerApplication: mongoose.models.SellerApplication || mongoose.model('SellerApplication', applicationSchema),
    Video: mongoose.models.Video || mongoose.model('Video', videoSchema)
};

// --- CLOUDINARY UPLOAD CONFIG ---
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: { folder: 'kishoreganj_properties', allowed_formats: ['jpg', 'jpeg', 'png', 'webp'] }
});
const upload = multer({ storage: storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

// --- HELPER: Unit Conversion ---
const getDecimalSize = (size, unit) => {
    const s = parseFloat(size);
    if (unit === 'Decimal') return s;
    if (unit === 'Katha') return s * 1.65;
    if (unit === 'Bigha') return s * 33;
    if (unit === 'Acre') return s * 100;
    return s;
};

// --- MOUNT ADMIN ROUTES ---
app.use('/admin', async (req, res, next) => { await connectDB(); next(); }, adminRouter(Models, upload));

// --- PUBLIC API ROUTES ---
app.get('/api/properties', async (req, res) => {
    await connectDB();
    const { upazila, category, minPrice, maxPrice } = req.query;
    let query = { status: 'Available' };
    if (upazila) query.upazila = upazila;
    if (category) query.landCategory = category;
    if (minPrice || maxPrice) {
        query.price = {};
        if (minPrice) query.price.$gte = Number(minPrice);
        if (maxPrice) query.price.$lte = Number(maxPrice);
    }
    const properties = await Models.Property.find(query).sort({ createdAt: -1 }).limit(50);
    res.json(properties);
});

app.get('/api/properties/:id', async (req, res) => {
    await connectDB();
    const property = await Models.Property.findById(req.params.id);
    res.json(property);
});

app.get('/api/videos', async (req, res) => {
    await connectDB();
    const videos = await Models.Video.find().sort({ createdAt: -1 });
    res.json(videos);
});

app.post('/api/applications', upload.array('images', 5), async (req, res) => {
    await connectDB();
    try {
        if (req.body.district !== 'Kishoreganj') return res.status(400).json({ error: 'Only Kishoreganj properties allowed.' });
        const imageUrls = req.files ? req.files.map(f => f.path) : [];
        const sizeInDecimal = getDecimalSize(req.body.landSize, req.body.landUnit);
        
        const newApp = new Models.SellerApplication({
            ...req.body, images: imageUrls, sizeInDecimal
        });
        await newApp.save();
        res.json({ success: true, applicationId: newApp._id });
    } catch (err) {
        res.status(500).json({ error: 'Failed to submit application.' });
    }
});

// --- PUBLIC FRONTEND (SPA HTML/CSS/JS) ---
const publicHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kishoreganj Land & Properties | Premium Real Estate</title>
    <meta name="description" content="Your Trusted Partner for Buying and Selling Land in Kishoreganj District, Bangladesh.">
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        :root {
            --bg: #e0e5ec; --primary: #10b981; --primary-dark: #059669; --secondary: #3b82f6; --accent: #f97316;
            --text-dark: #374151; --text-muted: #6b7280;
        }
        body { background-color: var(--bg); color: var(--text-dark); font-family: 'Segoe UI', system-ui, sans-serif; overflow-x: hidden; }
        
        /* Premium Claymorphism Utilities */
        .clay-card { background: var(--bg); border-radius: 24px; box-shadow: 12px 12px 24px #a3b1c6, -12px -12px 24px #ffffff; transition: transform 0.3s ease; }
        .clay-card:hover { transform: translateY(-5px); }
        .clay-inset { background: var(--bg); border-radius: 16px; box-shadow: inset 6px 6px 12px #a3b1c6, inset -6px -6px 12px #ffffff; }
        
        .clay-btn { background: var(--bg); border-radius: 14px; box-shadow: 6px 6px 12px #a3b1c6, -6px -6px 12px #ffffff; padding: 12px 24px; font-weight: 600; color: var(--text-dark); transition: all 0.2s ease; border: none; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 8px;}
        .clay-btn:active { box-shadow: inset 6px 6px 12px #a3b1c6, inset -6px -6px 12px #ffffff; }
        .clay-btn-primary { background: var(--primary); color: white; box-shadow: 6px 6px 12px #a3b1c6, -6px -6px 12px #ffffff; }
        
        .clay-input { width: 100%; background: var(--bg); border-radius: 12px; box-shadow: inset 5px 5px 10px #a3b1c6, inset -5px -5px 10px #ffffff; padding: 14px 16px; border: none; outline: none; color: var(--text-dark); font-size: 1rem; margin-bottom: 16px; }
        
        /* SPA Transitions */
        .page { display: none; opacity: 0; transition: opacity 0.4s ease; }
        .page.active { display: block; opacity: 1; animation: slideUp 0.5s ease; }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        /* Loader */
        .loader { border: 4px solid #f3f3f3; border-top: 4px solid var(--primary); border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 40px auto; display: none; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
</head>
<body>

    <!-- Header Navigation -->
    <nav class="clay-card m-4 px-6 py-4 flex justify-between items-center sticky top-4 z-50">
        <div class="flex items-center gap-3 cursor-pointer" onclick="nav('home')">
            <div class="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white text-xl shadow-lg"><i class="fas fa-leaf"></i></div>
            <div>
                <h1 class="font-bold text-xl text-green-700 leading-tight">Kishoreganj Properties</h1>
                <p class="text-xs text-gray-500">Premium Land Marketplace</p>
            </div>
        </div>
        <div class="hidden md:flex gap-4">
            <button onclick="nav('home')" class="clay-btn text-sm py-2">Home</button>
            <button onclick="nav('search')" class="clay-btn text-sm py-2">Buy Land</button>
            <button onclick="nav('videos')" class="clay-btn text-sm py-2">Videos</button>
            <button onclick="nav('sell')" class="clay-btn clay-btn-primary text-sm py-2">Sell Your Land</button>
        </div>
        <button class="md:hidden clay-btn py-2 px-4" onclick="document.getElementById('mob-menu').classList.toggle('hidden')"><i class="fas fa-bars"></i></button>
    </nav>
    <!-- Mobile Menu -->
    <div id="mob-menu" class="hidden md:hidden clay-card m-4 p-4 flex flex-col gap-3">
        <button onclick="nav('home')" class="clay-btn w-full">Home</button>
        <button onclick="nav('search')" class="clay-btn w-full">Buy Land</button>
        <button onclick="nav('videos')" class="clay-btn w-full">Videos</button>
        <button onclick="nav('sell')" class="clay-btn clay-btn-primary w-full">Sell Your Land</button>
    </div>

    <!-- MAIN CONTAINER -->
    <main class="max-w-7xl mx-auto px-4 pb-20 min-h-screen">
        <div id="loading" class="loader"></div>

        <!-- 1. HOME PAGE -->
        <section id="home" class="page active">
            <!-- Hero -->
            <div class="clay-card overflow-hidden relative mb-12 h-[500px] flex items-center justify-center text-center p-6 bg-gradient-to-br from-green-50 to-blue-50">
                <div class="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center"></div>
                <div class="relative z-10 max-w-2xl">
                    <h2 class="text-4xl md:text-6xl font-extrabold text-green-800 mb-6 drop-shadow-md">Find Your Dream Land in Kishoreganj</h2>
                    <p class="text-lg md:text-xl text-gray-700 mb-10 font-medium">Discover verified land opportunities across Kishoreganj and find the perfect property for your future.</p>
                    <div class="flex flex-col sm:flex-row gap-4 justify-center">
                        <button onclick="nav('search')" class="clay-btn clay-btn-primary text-lg px-8 py-4"><i class="fas fa-search"></i> Explore Available Land</button>
                        <button onclick="nav('sell')" class="clay-btn text-lg px-8 py-4"><i class="fas fa-hand-holding-usd"></i> Sell Your Land</button>
                    </div>
                </div>
            </div>

            <!-- Upazilas Grid -->
            <div class="mb-16">
                <h3 class="text-3xl font-bold text-center mb-10 text-gray-800">Explore Kishoreganj Upazilas</h3>
                <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6" id="upazila-grid">
                    <!-- Populated by JS -->
                </div>
            </div>

            <!-- Why Choose Us -->
            <div class="clay-inset p-10 mb-16">
                <h3 class="text-3xl font-bold text-center mb-10 text-gray-800">Why Choose Us?</h3>
                <div class="grid md:grid-cols-3 gap-8">
                    <div class="text-center"><div class="text-4xl text-green-500 mb-4"><i class="fas fa-map-marked-alt"></i></div><h4 class="font-bold text-xl mb-2">Local Knowledge</h4><p class="text-gray-600">Deep understanding of the Kishoreganj real estate market.</p></div>
                    <div class="text-center"><div class="text-4xl text-blue-500 mb-4"><i class="fas fa-shield-alt"></i></div><h4 class="font-bold text-xl mb-2">Verified Listings</h4><p class="text-gray-600">All properties undergo manual review by our dedicated agent.</p></div>
                    <div class="text-center"><div class="text-4xl text-orange-500 mb-4"><i class="fas fa-headset"></i></div><h4 class="font-bold text-xl mb-2">Direct Support</h4><p class="text-gray-600">Direct agent assistance from Mr. Rahman.</p></div>
                </div>
            </div>
        </section>

        <!-- 2. SEARCH / BUY LAND PAGE -->
        <section id="search" class="page">
            <div class="flex flex-col lg:flex-row gap-8">
                <!-- Filters Sidebar -->
                <div class="w-full lg:w-1/4">
                    <div class="clay-card p-6 sticky top-28">
                        <h3 class="font-bold text-xl mb-6"><i class="fas fa-filter"></i> Advanced Search</h3>
                        <label class="font-semibold block mb-2">Upazila</label>
                        <select id="filter-upazila" class="clay-input">
                            <option value="">All Upazilas</option>
                        </select>
                        
                        <label class="font-semibold block mb-2 mt-4">Category</label>
                        <select id="filter-category" class="clay-input">
                            <option value="">All Categories</option>
                            <option value="Residential Land">Residential Land</option>
                            <option value="Commercial Land">Commercial Land</option>
                            <option value="Agricultural Land">Agricultural Land</option>
                            <option value="Pond or Waterbody">Pond or Waterbody</option>
                        </select>

                        <label class="font-semibold block mb-2 mt-4">Price Range (BDT)</label>
                        <input type="number" id="filter-min-price" placeholder="Min Price" class="clay-input mb-2">
                        <input type="number" id="filter-max-price" placeholder="Max Price" class="clay-input">

                        <button onclick="executeSearch()" class="clay-btn clay-btn-primary w-full mt-4">Apply Filters</button>
                    </div>
                </div>
                
                <!-- Results -->
                <div class="w-full lg:w-3/4">
                    <h2 class="text-2xl font-bold mb-6" id="search-title">Available Properties</h2>
                    <div id="properties-grid" class="grid md:grid-cols-2 gap-6">
                        <!-- Populated by JS -->
                    </div>
                    <div id="no-results" class="hidden text-center p-10 clay-inset">
                        <i class="fas fa-folder-open text-4xl text-gray-400 mb-4"></i>
                        <p class="text-xl text-gray-600">No properties match your search.</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- 3. PROPERTY DETAILS PAGE -->
        <section id="details" class="page">
            <button onclick="nav('search')" class="clay-btn mb-6"><i class="fas fa-arrow-left"></i> Back to Search</button>
            <div id="details-content" class="grid lg:grid-cols-3 gap-8">
                <!-- Populated dynamically -->
            </div>
        </section>

        <!-- 4. SELL YOUR LAND PAGE -->
        <section id="sell" class="page max-w-3xl mx-auto">
            <div class="clay-card p-8">
                <div class="text-center mb-8">
                    <h2 class="text-3xl font-bold text-green-700 mb-2">Sell Your Land in Kishoreganj</h2>
                    <p class="text-gray-600">Submit your property details below. Mr. Rahman will review and contact you shortly.</p>
                </div>
                <form id="sell-form" onsubmit="submitLand(event)">
                    <div class="grid md:grid-cols-2 gap-4">
                        <div>
                            <label class="font-semibold block mb-1">Full Name *</label>
                            <input type="text" name="sellerName" required class="clay-input">
                        </div>
                        <div>
                            <label class="font-semibold block mb-1">Mobile Number *</label>
                            <input type="tel" name="phone" required class="clay-input">
                        </div>
                    </div>

                    <div class="grid md:grid-cols-2 gap-4">
                        <div>
                            <label class="font-semibold block mb-1">Upazila *</label>
                            <select name="upazila" id="sell-upazila" required class="clay-input"></select>
                        </div>
                        <div>
                            <label class="font-semibold block mb-1">Village/Area *</label>
                            <input type="text" name="village" required class="clay-input">
                        </div>
                    </div>

                    <div class="grid md:grid-cols-3 gap-4">
                        <div>
                            <label class="font-semibold block mb-1">Land Size *</label>
                            <input type="number" step="0.01" name="landSize" required class="clay-input">
                        </div>
                        <div>
                            <label class="font-semibold block mb-1">Unit *</label>
                            <select name="landUnit" required class="clay-input">
                                <option value="Decimal">Decimal (Shotok)</option>
                                <option value="Katha">Katha</option>
                                <option value="Bigha">Bigha</option>
                                <option value="Acre">Acre</option>
                            </select>
                        </div>
                        <div>
                            <label class="font-semibold block mb-1">Expected Price (BDT) *</label>
                            <input type="number" name="expectedPrice" required class="clay-input">
                        </div>
                    </div>

                    <div class="grid md:grid-cols-2 gap-4">
                        <div>
                            <label class="font-semibold block mb-1">Category</label>
                            <select name="landCategory" required class="clay-input">
                                <option value="Residential Land">Residential Land</option>
                                <option value="Commercial Land">Commercial Land</option>
                                <option value="Agricultural Land">Agricultural Land</option>
                                <option value="Pond or Waterbody">Pond or Waterbody</option>
                            </select>
                        </div>
                        <div>
                            <label class="font-semibold block mb-1">Road Access</label>
                            <input type="text" name="roadAccess" placeholder="e.g. 12ft muddy road" class="clay-input">
                        </div>
                    </div>

                    <label class="font-semibold block mb-1">Detailed Description *</label>
                    <textarea name="description" rows="4" required class="clay-input" placeholder="Describe the land, surrounding area, current condition..."></textarea>

                    <label class="font-semibold block mb-1">Upload Photos (Max 5, up to 5MB total)</label>
                    <input type="file" name="images" accept="image/*" multiple required class="clay-input bg-white cursor-pointer">
                    
                    <!-- Fixed District Hidden -->
                    <input type="hidden" name="district" value="Kishoreganj">

                    <button type="submit" id="sell-submit-btn" class="clay-btn clay-btn-primary w-full text-lg py-4 mt-4">
                        <i class="fas fa-paper-plane"></i> Submit Property for Review
                    </button>
                    <p id="sell-msg" class="mt-4 text-center font-bold hidden"></p>
                </form>
            </div>
        </section>

        <!-- 5. VIDEOS PAGE -->
        <section id="videos" class="page">
            <h2 class="text-3xl font-bold text-center mb-10 text-gray-800">Property Videos</h2>
            <div id="videos-grid" class="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                <!-- Populated dynamically -->
            </div>
            <div id="no-videos" class="hidden text-center p-10 clay-inset">
                <i class="fas fa-video-slash text-4xl text-gray-400 mb-4"></i>
                <p class="text-xl text-gray-600">No videos available at the moment.</p>
            </div>
        </section>

    </main>

    <!-- FOOTER -->
    <footer class="clay-card mx-4 mb-4 mt-10 p-8 text-center md:text-left">
        <div class="max-w-7xl mx-auto grid md:grid-cols-3 gap-8">
            <div>
                <h3 class="font-bold text-xl text-green-700 mb-4">Kishoreganj Properties</h3>
                <p class="text-gray-600">Your Trusted Partner for Buying and Selling Land in Kishoreganj District.</p>
            </div>
            <div>
                <h4 class="font-bold text-lg mb-4">Contact Agent</h4>
                <p class="text-gray-600"><i class="fas fa-user text-green-500 w-6"></i> Mr. Rahman</p>
                <p class="text-gray-600"><i class="fas fa-phone-alt text-blue-500 w-6"></i> +8801700123456</p>
                <p class="text-gray-600"><i class="fas fa-envelope text-orange-500 w-6"></i> info@kishoreganjproperties.com</p>
            </div>
            <div>
                <h4 class="font-bold text-lg mb-4">Quick Links</h4>
                <a onclick="nav('search')" class="block text-gray-600 hover:text-green-600 cursor-pointer mb-2">Buy Land</a>
                <a onclick="nav('sell')" class="block text-gray-600 hover:text-green-600 cursor-pointer mb-2">Sell Land</a>
                <a href="/admin" class="block text-gray-400 hover:text-gray-600 text-sm mt-4 cursor-pointer"><i class="fas fa-lock"></i> Admin Login</a>
            </div>
        </div>
        <div class="text-center text-gray-500 text-sm mt-8 border-t border-gray-300 pt-4">
            &copy; 2026 Kishoreganj Land & Properties. All Rights Reserved.
        </div>
    </footer>

    <!-- CLIENT SIDE LOGIC -->
    <script>
        const UPAZILAS = ["Kishoreganj Sadar", "Bhairab", "Bajitpur", "Kuliarchar", "Hossainpur", "Pakundia", "Karimganj", "Tarail", "Itna", "Mithamain", "Austagram", "Nikli", "Katiadi"];
        const AgentPhone = "+8801700123456";

        function init() {
            // Populate Upazilas
            const upazilaGrid = document.getElementById('upazila-grid');
            const filterUpazila = document.getElementById('filter-upazila');
            const sellUpazila = document.getElementById('sell-upazila');
            
            UPAZILAS.forEach(u => {
                // Home Grid
                const div = document.createElement('div');
                div.className = 'clay-btn py-4 text-center hover:text-green-600 cursor-pointer font-semibold';
                div.innerText = u;
                div.onclick = () => { document.getElementById('filter-upazila').value = u; nav('search'); executeSearch(); };
                upazilaGrid.appendChild(div);

                // Selects
                filterUpazila.innerHTML += \`<option value="\${u}">\${u}</option>\`;
                sellUpazila.innerHTML += \`<option value="\${u}">\${u}</option>\`;
            });

            // Initial route
            nav('home');
        }

        function nav(pageId) {
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.getElementById(pageId).classList.add('active');
            window.scrollTo({top: 0, behavior: 'smooth'});
            
            if(pageId === 'search') executeSearch();
            if(pageId === 'videos') loadVideos();
            document.getElementById('mob-menu').classList.add('hidden');
        }

        const showLoading = (show) => document.getElementById('loading').style.display = show ? 'block' : 'none';

        async function executeSearch() {
            showLoading(true);
            const u = document.getElementById('filter-upazila').value;
            const c = document.getElementById('filter-category').value;
            const min = document.getElementById('filter-min-price').value;
            const max = document.getElementById('filter-max-price').value;

            let url = '/api/properties?';
            if(u) url += \`upazila=\${u}&\`;
            if(c) url += \`category=\${c}&\`;
            if(min) url += \`minPrice=\${min}&\`;
            if(max) url += \`maxPrice=\${max}\`;

            try {
                const res = await fetch(url);
                const props = await res.json();
                renderProperties(props);
            } catch(e) { console.error(e); }
            showLoading(false);
        }

        function renderProperties(props) {
            const grid = document.getElementById('properties-grid');
            const noRes = document.getElementById('no-results');
            grid.innerHTML = '';
            
            if(props.length === 0) {
                grid.classList.add('hidden');
                noRes.classList.remove('hidden');
                return;
            }
            
            grid.classList.remove('hidden');
            noRes.classList.add('hidden');

            props.forEach(p => {
                const img = p.coverImage || 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=800&auto=format&fit=crop';
                grid.innerHTML += \`
                <div class="clay-card overflow-hidden flex flex-col cursor-pointer" onclick="viewDetails('\${p._id}')">
                    <img src="\${img}" class="w-full h-48 object-cover" alt="Property">
                    <div class="p-6 flex-1 flex flex-col">
                        <div class="flex justify-between items-start mb-2">
                            <span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-bold">\${p.landCategory}</span>
                            <span class="font-bold text-lg text-green-600">৳ \${p.price.toLocaleString()}</span>
                        </div>
                        <h3 class="font-bold text-xl mb-2 line-clamp-2">\${p.title}</h3>
                        <p class="text-gray-500 text-sm mb-4"><i class="fas fa-map-marker-alt"></i> \${p.upazila}, \${p.village}</p>
                        <div class="mt-auto pt-4 border-t border-gray-200 flex justify-between text-sm">
                            <span><i class="fas fa-vector-square text-blue-500"></i> \${p.landSize} \${p.landUnit}</span>
                            <button class="text-green-600 font-bold">View Details <i class="fas fa-arrow-right"></i></button>
                        </div>
                    </div>
                </div>\`;
            });
        }

        async function viewDetails(id) {
            nav('details');
            showLoading(true);
            const container = document.getElementById('details-content');
            container.innerHTML = '';
            try {
                const res = await fetch(\`/api/properties/\${id}\`);
                const p = await res.json();
                
                const img = p.coverImage || 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=800&auto=format&fit=crop';
                
                container.innerHTML = \`
                <div class="lg:col-span-2 space-y-6">
                    <div class="clay-card overflow-hidden">
                        <img src="\${img}" class="w-full h-[400px] object-cover">
                    </div>
                    <div class="clay-card p-8">
                        <div class="flex justify-between items-center mb-4">
                            <span class="bg-green-100 text-green-800 px-3 py-1 rounded-full font-bold">\${p.landCategory}</span>
                            <span class="text-gray-500 text-sm">ID: \${p._id.slice(-6).toUpperCase()}</span>
                        </div>
                        <h1 class="text-3xl font-bold mb-4">\${p.title}</h1>
                        <p class="text-xl text-green-600 font-bold mb-6">Asking Price: ৳\${p.price.toLocaleString()}</p>
                        
                        <h3 class="font-bold text-xl mb-3 border-b pb-2">Property Description</h3>
                        <p class="text-gray-700 whitespace-pre-line leading-relaxed mb-6">\${p.description}</p>
                        
                        <h3 class="font-bold text-xl mb-3 border-b pb-2">Property Features</h3>
                        <ul class="grid grid-cols-2 gap-4 text-gray-700">
                            <li><strong>District:</strong> \${p.district}</li>
                            <li><strong>Upazila:</strong> \${p.upazila}</li>
                            <li><strong>Village/Area:</strong> \${p.village}</li>
                            <li><strong>Size:</strong> \${p.landSize} \${p.landUnit}</li>
                            <li><strong>Road Access:</strong> \${p.roadAccess || 'N/A'}</li>
                        </ul>
                    </div>
                </div>
                <div>
                    <div class="clay-card p-6 sticky top-28 text-center">
                        <div class="w-24 h-24 bg-gray-200 rounded-full mx-auto mb-4 overflow-hidden border-4 border-white shadow-md">
                            <img src="https://ui-avatars.com/api/?name=Mr+Rahman&background=10b981&color=fff" class="w-full h-full object-cover">
                        </div>
                        <h3 class="font-bold text-xl">Mr. Rahman</h3>
                        <p class="text-gray-500 mb-6">Dedicated Kishoreganj Agent</p>
                        
                        <a href="tel:\${AgentPhone}" class="clay-btn clay-btn-primary w-full mb-4"><i class="fas fa-phone-alt"></i> Call Now</a>
                        <a href="https://wa.me/\${AgentPhone.replace('+', '')}" target="_blank" class="clay-btn w-full !bg-green-500 !text-white mb-4"><i class="fab fa-whatsapp"></i> WhatsApp</a>
                        
                        <p class="text-xs text-gray-400 mt-4">Reference ID: \${p._id.slice(-6).toUpperCase()}</p>
                    </div>
                </div>\`;
            } catch(e) { console.error(e); }
            showLoading(false);
        }

        async function submitLand(e) {
            e.preventDefault();
            const btn = document.getElementById('sell-submit-btn');
            const msg = document.getElementById('sell-msg');
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
            btn.disabled = true;

            const form = document.getElementById('sell-form');
            const formData = new FormData(form);

            try {
                const res = await fetch('/api/applications', { method: 'POST', body: formData });
                const data = await res.json();
                
                if(data.success) {
                    msg.innerHTML = '<span class="text-green-600"><i class="fas fa-check-circle"></i> Application Submitted Successfully! We will contact you soon.</span>';
                    msg.classList.remove('hidden');
                    form.reset();
                } else {
                    msg.innerHTML = \`<span class="text-red-500"><i class="fas fa-times-circle"></i> \${data.error || 'Submission failed.'}</span>\`;
                    msg.classList.remove('hidden');
                }
            } catch(err) {
                msg.innerHTML = '<span class="text-red-500"><i class="fas fa-times-circle"></i> Network Error.</span>';
                msg.classList.remove('hidden');
            }
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Property for Review';
            btn.disabled = false;
        }

        async function loadVideos() {
            showLoading(true);
            const grid = document.getElementById('videos-grid');
            const noVids = document.getElementById('no-videos');
            grid.innerHTML = '';
            
            try {
                const res = await fetch('/api/videos');
                const vids = await res.json();
                
                if(vids.length === 0) {
                    noVids.classList.remove('hidden');
                } else {
                    noVids.classList.add('hidden');
                    vids.forEach(v => {
                        grid.innerHTML += \`
                        <div class="clay-card overflow-hidden">
                            <div class="aspect-video bg-gray-900">
                                <iframe src="\${v.url}" class="w-full h-full" frameborder="0" allowfullscreen></iframe>
                            </div>
                            <div class="p-6">
                                <h3 class="font-bold text-lg mb-2">\${v.title}</h3>
                            </div>
                        </div>\`;
                    });
                }
            } catch(e) { console.error(e); }
            showLoading(false);
        }

        // Initialize App
        window.onload = init;
    </script>
</body>
</html>`;

app.get('/', (req, res) => res.send(publicHTML));

// --- EXPORT APP FOR VERCEL ---
module.exports = app;
