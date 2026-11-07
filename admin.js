const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

module.exports = function (Models, upload) {
    const router = express.Router();
    const { Property, SellerApplication, Video, Setting } = Models;

    // --- ADMIN FRONTEND (CLAYMORPHISM UI) ---
    const adminHTML = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Admin Dashboard - Kishoreganj Properties</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <style>
            :root {
                --bg: #e0e5ec;
                --primary: #4ade80;
                --text: #4b5563;
            }
            body { background-color: var(--bg); color: var(--text); font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
            .clay { background: var(--bg); border-radius: 20px; box-shadow: 9px 9px 16px #a3b1c6, -9px -9px 16px #ffffff; }
            .clay-btn { background: var(--bg); border-radius: 12px; box-shadow: 5px 5px 10px #a3b1c6, -5px -5px 10px #ffffff; transition: all 0.2s; font-weight: 600; padding: 10px 20px; cursor: pointer; border: none; }
            .clay-btn:active { box-shadow: inset 5px 5px 10px #a3b1c6, inset -5px -5px 10px #ffffff; }
            .clay-input { background: var(--bg); border-radius: 12px; box-shadow: inset 5px 5px 10px #a3b1c6, inset -5px -5px 10px #ffffff; padding: 12px; border: none; outline: none; width: 100%; }
            .section { display: none; animation: fadeIn 0.4s ease; }
            .section.active { display: block; }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            table { width: 100%; text-align: left; border-collapse: collapse; }
            th, td { padding: 12px; border-bottom: 1px solid #d1d9e6; }
        </style>
    </head>
    <body class="p-6">
        <div id="login-screen" class="section max-w-md mx-auto clay p-8 mt-20">
            <h2 class="text-2xl font-bold mb-6 text-center text-green-600">Admin Login</h2>
            <input type="text" id="username" placeholder="Username" class="clay-input mb-4">
            <input type="password" id="password" placeholder="Password" class="clay-input mb-6">
            <button onclick="login()" class="clay-btn w-full text-green-600">Secure Login</button>
            <p id="login-error" class="text-red-500 mt-4 text-center hidden"></p>
        </div>

        <div id="dashboard-screen" class="section">
            <div class="flex flex-col md:flex-row gap-6">
                <!-- Sidebar -->
                <div class="clay p-6 w-full md:w-64 h-fit sticky top-6">
                    <h3 class="font-bold text-xl mb-6 text-green-600"><i class="fas fa-shield-alt"></i> Admin Panel</h3>
                    <ul class="space-y-4">
                        <li><button onclick="nav('overview')" class="clay-btn w-full text-left"><i class="fas fa-chart-pie w-6"></i> Overview</button></li>
                        <li><button onclick="nav('properties')" class="clay-btn w-full text-left"><i class="fas fa-map-marked-alt w-6"></i> Properties</button></li>
                        <li><button onclick="nav('applications')" class="clay-btn w-full text-left"><i class="fas fa-file-signature w-6"></i> Applications</button></li>
                        <li><button onclick="nav('videos')" class="clay-btn w-full text-left"><i class="fas fa-video w-6"></i> Videos</button></li>
                        <li><button onclick="logout()" class="clay-btn w-full text-left text-red-500 mt-8"><i class="fas fa-sign-out-alt w-6"></i> Logout</button></li>
                    </ul>
                </div>

                <!-- Content -->
                <div class="flex-1 space-y-6">
                    <!-- Overview -->
                    <div id="overview" class="view-section active space-y-6">
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div class="clay p-6 text-center"><h4 class="text-xl font-bold text-gray-700">Total Properties</h4><p id="stat-props" class="text-3xl text-green-600 mt-2">0</p></div>
                            <div class="clay p-6 text-center"><h4 class="text-xl font-bold text-gray-700">Pending Apps</h4><p id="stat-apps" class="text-3xl text-orange-500 mt-2">0</p></div>
                            <div class="clay p-6 text-center"><h4 class="text-xl font-bold text-gray-700">Total Videos</h4><p id="stat-vids" class="text-3xl text-blue-500 mt-2">0</p></div>
                        </div>
                    </div>

                    <!-- Applications -->
                    <div id="applications" class="view-section hidden clay p-6">
                        <h2 class="text-2xl font-bold mb-4">Seller Applications</h2>
                        <div class="overflow-x-auto">
                            <table>
                                <thead><tr><th>Name</th><th>Phone</th><th>Area</th><th>Status</th><th>Actions</th></tr></thead>
                                <tbody id="app-list"></tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Properties -->
                    <div id="properties" class="view-section hidden clay p-6">
                        <div class="flex justify-between items-center mb-4">
                            <h2 class="text-2xl font-bold">Manage Properties</h2>
                        </div>
                        <div class="overflow-x-auto">
                            <table>
                                <thead><tr><th>Title</th><th>Upazila</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead>
                                <tbody id="prop-list"></tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Videos -->
                    <div id="videos" class="view-section hidden clay p-6">
                        <h2 class="text-2xl font-bold mb-4">Manage Videos</h2>
                        <div class="mb-6 p-4 border border-gray-300 rounded-xl">
                            <h3 class="font-bold mb-2">Add New Video</h3>
                            <input type="text" id="vid-title" placeholder="Video Title" class="clay-input mb-3">
                            <input type="text" id="vid-url" placeholder="Embed URL (Youtube/Facebook/MP4)" class="clay-input mb-3">
                            <button onclick="addVideo()" class="clay-btn text-blue-600">Save Video</button>
                        </div>
                        <div id="vid-list" class="grid grid-cols-1 md:grid-cols-2 gap-4"></div>
                    </div>
                </div>
            </div>
        </div>

        <script>
            let currentToken = null;

            // Simple routing
            function nav(id) {
                document.querySelectorAll('.view-section').forEach(e => e.classList.add('hidden'));
                document.getElementById(id).classList.remove('hidden');
                if(id === 'overview') loadStats();
                if(id === 'applications') loadApps();
                if(id === 'properties') loadProps();
                if(id === 'videos') loadVideos();
            }

            async function apiReq(url, options = {}) {
                options.credentials = 'same-origin';
                if(!options.headers) options.headers = {};
                if(options.body && !(options.body instanceof FormData)) {
                    options.headers['Content-Type'] = 'application/json';
                    options.body = JSON.stringify(options.body);
                }
                const res = await fetch(url, options);
                if (res.status === 401) { showScreen('login-screen'); return null; }
                return await res.json();
            }

            async function login() {
                const u = document.getElementById('username').value;
                const p = document.getElementById('password').value;
                const res = await fetch('/admin/api/login', {
                    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username: u, password: p})
                });
                if(res.ok) { showScreen('dashboard-screen'); nav('overview'); } 
                else { document.getElementById('login-error').classList.remove('hidden'); document.getElementById('login-error').innerText = "Invalid Credentials"; }
            }

            async function logout() {
                await fetch('/admin/api/logout', {method: 'POST'});
                showScreen('login-screen');
            }

            function showScreen(id) {
                document.querySelectorAll('.section').forEach(e => e.classList.remove('active'));
                document.getElementById(id).classList.add('active');
            }

            async function loadStats() {
                const data = await apiReq('/admin/api/stats');
                if(!data) return;
                document.getElementById('stat-props').innerText = data.properties;
                document.getElementById('stat-apps').innerText = data.applications;
                document.getElementById('stat-vids').innerText = data.videos;
            }

            async function loadApps() {
                const apps = await apiReq('/admin/api/applications');
                if(!apps) return;
                let h = '';
                apps.forEach(a => {
                    h += \`<tr>
                        <td>\${a.sellerName}</td>
                        <td>\${a.phone}</td>
                        <td>\${a.upazila}, \${a.village}</td>
                        <td><span class="px-2 py-1 bg-yellow-200 text-yellow-800 rounded">\${a.status}</span></td>
                        <td>
                            <button onclick="reviewApp('\${a._id}')" class="clay-btn text-sm">Review</button>
                        </td>
                    </tr>\`;
                });
                document.getElementById('app-list').innerHTML = h || '<tr><td colspan="5">No applications found.</td></tr>';
            }

            async function reviewApp(id) {
                if(confirm("Approve this application and convert to a public Property listing?")) {
                    await apiReq(\`/admin/api/applications/\${id}/approve\`, { method: 'POST' });
                    alert("Approved & Published!");
                    loadApps();
                }
            }

            async function loadProps() {
                const props = await apiReq('/admin/api/properties');
                if(!props) return;
                let h = '';
                props.forEach(p => {
                    h += \`<tr>
                        <td>\${p.title}</td><td>\${p.upazila}</td><td>৳\${p.price}</td><td>\${p.status}</td>
                        <td><button onclick="delProp('\${p._id}')" class="clay-btn text-sm text-red-500">Delete</button></td>
                    </tr>\`;
                });
                document.getElementById('prop-list').innerHTML = h || '<tr><td colspan="5">No properties found.</td></tr>';
            }
            
            async function delProp(id) {
                if(confirm("Delete this property?")) {
                    await apiReq(\`/admin/api/properties/\${id}\`, { method: 'DELETE' });
                    loadProps();
                }
            }

            async function loadVideos() {
                const vids = await apiReq('/admin/api/videos');
                if(!vids) return;
                let h = '';
                vids.forEach(v => {
                    h += \`<div class="clay p-4">
                        <h4 class="font-bold mb-2">\${v.title}</h4>
                        <div class="aspect-video bg-gray-200 mb-2 overflow-hidden rounded-lg">
                            <iframe src="\${v.url}" class="w-full h-full" frameborder="0" allowfullscreen></iframe>
                        </div>
                        <button onclick="delVid('\${v._id}')" class="clay-btn w-full text-red-500 text-sm">Delete</button>
                    </div>\`;
                });
                document.getElementById('vid-list').innerHTML = h || '<p>No videos added yet.</p>';
            }

            async function addVideo() {
                const title = document.getElementById('vid-title').value;
                const url = document.getElementById('vid-url').value;
                if(!title || !url) return alert('Fill fields');
                await apiReq('/admin/api/videos', { method: 'POST', body: { title, url } });
                document.getElementById('vid-title').value = ''; document.getElementById('vid-url').value = '';
                loadVideos();
            }

            async function delVid(id) {
                if(confirm("Delete video?")) {
                    await apiReq(\`/admin/api/videos/\${id}\`, { method: 'DELETE' });
                    loadVideos();
                }
            }

            // Check session on load
            window.onload = async () => {
                const data = await apiReq('/admin/api/stats');
                if(data) { showScreen('dashboard-screen'); loadStats(); }
            };
        </script>
    </body>
    </html>
    `;

    // --- ADMIN MIDDLEWARE ---
    const requireAdmin = (req, res, next) => {
        const token = req.cookies.admin_token;
        if (!token) return res.status(401).json({ error: 'Unauthorized' });
        try {
            jwt.verify(token, process.env.SESSION_SECRET);
            next();
        } catch (err) {
            res.status(401).json({ error: 'Invalid Token' });
        }
    };

    // --- ADMIN ROUTES ---
    router.get('/', (req, res) => res.send(adminHTML));

    router.post('/api/login', async (req, res) => {
        const { username, password } = req.body;
        const envUser = process.env.ADMIN_USERNAME || 'admin';
        // Fallback hash for 'password123' if not set
        const envHash = process.env.ADMIN_PASSWORD_HASH || '$2a$10$3p4lA9tC8O/sE9/g7o8u1u9W.8D5F6T/q6k9/yH.p6.V0w0U1Y8Pq'; 
        
        if (username !== envUser) return res.status(401).json({ error: 'Invalid credentials' });
        const isMatch = await bcrypt.compare(password, envHash);
        if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });
        
        const token = jwt.sign({ admin: true }, process.env.SESSION_SECRET, { expiresIn: '1d' });
        res.cookie('admin_token', token, { httpOnly: true, secure: true, maxAge: 86400000 });
        res.json({ success: true });
    });

    router.post('/api/logout', (req, res) => {
        res.clearCookie('admin_token');
        res.json({ success: true });
    });

    router.get('/api/stats', requireAdmin, async (req, res) => {
        try {
            const properties = await Property.countDocuments();
            const applications = await SellerApplication.countDocuments({ status: 'Pending' });
            const videos = await Video.countDocuments();
            res.json({ properties, applications, videos });
        } catch (e) { res.status(500).json({ error: 'Error fetching stats' }); }
    });

    // Applications Management
    router.get('/api/applications', requireAdmin, async (req, res) => {
        const apps = await SellerApplication.find().sort({ createdAt: -1 });
        res.json(apps);
    });

    router.post('/api/applications/:id/approve', requireAdmin, async (req, res) => {
        try {
            const app = await SellerApplication.findById(req.params.id);
            if (!app) return res.status(404).json({ error: 'Not found' });
            app.status = 'Approved';
            await app.save();

            // Convert to property
            const newProp = new Property({
                title: `${app.landSize} ${app.landUnit} ${app.landCategory} in ${app.village}`,
                description: app.description,
                district: app.district,
                upazila: app.upazila,
                union: app.union,
                village: app.village,
                landSize: app.landSize,
                landUnit: app.landUnit,
                price: app.expectedPrice,
                landCategory: app.landCategory,
                roadAccess: app.roadAccess,
                images: app.images,
                coverImage: app.images[0] || '',
                status: 'Available',
                sizeInDecimal: app.sizeInDecimal
            });
            await newProp.save();
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: 'Server error' }); }
    });

    // Properties Management
    router.get('/api/properties', requireAdmin, async (req, res) => {
        const props = await Property.find().sort({ createdAt: -1 });
        res.json(props);
    });

    router.delete('/api/properties/:id', requireAdmin, async (req, res) => {
        await Property.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    });

    // Video Management
    router.get('/api/videos', requireAdmin, async (req, res) => {
        const vids = await Video.find().sort({ createdAt: -1 });
        res.json(vids);
    });

    router.post('/api/videos', requireAdmin, async (req, res) => {
        const vid = new Video(req.body);
        await vid.save();
        res.json({ success: true });
    });

    router.delete('/api/videos/:id', requireAdmin, async (req, res) => {
        await Video.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    });

    return router;
};
