/**
 * Shared News Logic (Supabase Integrated)
 * Handles fetching, displaying, and managing news items.
 * Uses Supabase 'news' table for persistence.
 */

// Global config access
function getSupabaseCredentials() {
    let url = window.SB_URL;
    let key = window.SB_KEY;

    if (!url || !key) {
        if (window.SUPABASE_PUBLIC_CONFIG) {
            url = window.SUPABASE_PUBLIC_CONFIG.URL;
            key = window.SUPABASE_PUBLIC_CONFIG.ANON_KEY;
        } else {
             try {
                const stored = localStorage.getItem('supabaseSyncSettings');
                if (stored) {
                    const settings = JSON.parse(stored);
                    url = settings.url;
                    key = settings.key;
                }
             } catch(e) {}
        }
    }
    return { url, key };
}

async function getNews() {
    const { url, key } = getSupabaseCredentials();
    
    // Fallback to local storage
    if (!url || !key) {
        console.warn("News: Supabase not configured. Using local storage.");
        const stored = localStorage.getItem('mh_news_data');
        return stored ? JSON.parse(stored) : [];
    }

    try {
        const requestUrl = `${url.replace(/\/$/, '')}/rest/v1/news?order=news_date.desc`;
        const response = await fetch(requestUrl, {
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            return data.map(item => ({
                id: item.id,
                title: item.title,
                content: item.content,
                author: item.author,
                date: item.news_date,
                image_url: item.image_url,
                video_url: item.video_url,
                link_url: item.link_url,
                publisher_role: item.publisher_role
            }));
        } else {
            console.error("News: Failed to fetch", await response.text());
            throw new Error("Fetch failed");
        }
    } catch (e) {
        console.error("News: Network error", e);
        const stored = localStorage.getItem('mh_news_data');
        return stored ? JSON.parse(stored) : [];
    }
}

async function saveNews(newsItem) {
    const { url, key } = getSupabaseCredentials();

    if (!url || !key) {
        const current = JSON.parse(localStorage.getItem('mh_news_data') || '[]');
        current.push(newsItem);
        localStorage.setItem('mh_news_data', JSON.stringify(current));
        return true;
    }

    try {
        const requestUrl = `${url.replace(/\/$/, '')}/rest/v1/news`;
        const payload = {
            title: newsItem.title,
            content: newsItem.content,
            author: newsItem.author,
            news_date: newsItem.date,
            image_url: newsItem.image_url,
            video_url: newsItem.video_url,
            link_url: newsItem.link_url,
            publisher_role: newsItem.publisher_role
        };

        const response = await fetch(requestUrl, {
            method: 'POST',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            return true;
        } else {
            alert("Error saving to cloud: " + await response.text());
            return false;
        }
    } catch (e) {
        console.error(e);
        alert("Network error: Could not save news.");
        return false;
    }
}

async function deleteNews(id) {
    if (!confirm('Are you sure you want to delete this news item?')) return;

    const { url, key } = getSupabaseCredentials();
    
    if (!url || !key) {
         let current = JSON.parse(localStorage.getItem('mh_news_data') || '[]');
         current = current.filter(item => item.id.toString() !== id.toString());
         localStorage.setItem('mh_news_data', JSON.stringify(current));
         renderNewsAdmin(); 
         return;
    }

    try {
        const requestUrl = `${url.replace(/\/$/, '')}/rest/v1/news?id=eq.${id}`;
        const response = await fetch(requestUrl, {
            method: 'DELETE',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`
            }
        });

        if (response.ok) {
            renderNewsAdmin(); 
        } else {
            alert("Error deleting: " + await response.text());
        }
    } catch (e) {
        console.error(e);
        alert("Network Error");
    }
}

function formatDate(dateString) {
    if (!dateString) return '';
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString('en-US', options);
}

// --- Render Logic ---

function createNewsCardHtml(item, isAdmin = false) {
    let mediaHtml = '';
    
    if (item.video_url) {
        mediaHtml += `
            <video class="news-video" 
                   src="${escapeHtml(item.video_url)}" 
                   controlsList="nodownload" 
                   oncontextmenu="return false;"
                   onclick="openLightbox('${escapeHtml(item.video_url)}', 'video')"
                   preload="metadata">
            </video>
            <div style="text-align:center; margin-top:-10px; margin-bottom:15px; font-size:0.8rem; color:#aaa;">(Click to Watch)</div>
        `;
    }
    
    if (item.image_url) {
        mediaHtml += `<img src="${escapeHtml(item.image_url)}" 
                           alt="News Image" 
                           class="news-image" 
                           onerror="this.style.display='none'"
                           onclick="openLightbox('${escapeHtml(item.image_url)}', 'image')">`;
    }

    let linkHtml = '';
    if (item.link_url) {
        let url = item.link_url;
        if (!/^https?:\/\//i.test(url)) {
            url = 'https://' + url;
        }
        linkHtml = `
            <div style="margin-top: 10px;">
                <a href="${escapeHtml(url)}" target="_blank" class="news-link-btn">Read More &rarr;</a>
            </div>
        `;
    }

    let deleteBtnHtml = '';
    if (isAdmin) {
        deleteBtnHtml = `<button class="btn-danger" onclick="deleteNews('${item.id}')" style="margin-left: auto;">Delete</button>`;
    }

    return `
        <div class="news-header">
            <h3 class="news-title">${escapeHtml(item.title)}</h3>
            <span class="news-date">${formatDate(item.date)}</span>
            ${isAdmin ? deleteBtnHtml : ''}
        </div>
        ${mediaHtml}
        <div class="news-content">${formatContent(item.content)}</div>
        ${linkHtml}
        <div class="news-footer">
            <span class="news-author">By ${escapeHtml(item.author || 'Admin')}</span>
        </div>
    `;
}

// --- Lightbox Logic ---

function setupLightbox() {
    if (document.getElementById('mh-lightbox')) return;

    const lightbox = document.createElement('div');
    lightbox.id = 'mh-lightbox';
    lightbox.className = 'lightbox';
    lightbox.innerHTML = `
        <span class="lightbox-close">&times;</span>
        <div id="lightbox-container" style="display:flex; justify-content:center; width:100%;"></div>
    `;
    document.body.appendChild(lightbox);
    
    lightbox.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) closeLightbox();
    });
}

function openLightbox(src, type) {
    const lightbox = document.getElementById('mh-lightbox');
    const container = document.getElementById('lightbox-container');
    if (!lightbox || !container) return;

    container.innerHTML = ''; 

    if (type === 'video') {
        const video = document.createElement('video');
        video.className = 'lightbox-content';
        video.src = src;
        video.controls = true;
        video.setAttribute('controlsList', 'nodownload');
        video.setAttribute('disablePictureInPicture', 'true');
        video.oncontextmenu = (e) => { e.preventDefault(); return false; }; 
        container.appendChild(video);
    } else {
        const img = document.createElement('img');
        img.className = 'lightbox-content';
        img.src = src;
        container.appendChild(img);
    }
    lightbox.classList.add('active');
}

function closeLightbox() {
    const lightbox = document.getElementById('mh-lightbox');
    const container = document.getElementById('lightbox-container');
    if (lightbox) {
        lightbox.classList.remove('active');
        if (container) container.innerHTML = ''; 
    }
}

window.openLightbox = openLightbox;
window.closeLightbox = closeLightbox;

// --- Public Page Logic ---

async function renderNewsPublic() {
    const listContainer = document.getElementById('news-list-public');
    if (!listContainer) return;

    listContainer.innerHTML = '<p style="text-align:center; color:#888;">Loading latest news...</p>';

    const newsItems = await getNews();
    
    listContainer.innerHTML = '';

    if (newsItems.length === 0) {
        listContainer.innerHTML = '<div class="empty-state">No news updates available at the moment.</div>';
        return;
    }

    newsItems.forEach(item => {
        const card = document.createElement('div');
        card.className = 'news-card';
        card.innerHTML = createNewsCardHtml(item, false);
        listContainer.appendChild(card);
    });
}

// --- Admin Page Logic ---

async function renderNewsAdmin() {
    const listContainer = document.getElementById('news-list-admin');
    if (!listContainer) return;

    listContainer.innerHTML = '<p style="text-align:center; color:#888;">Fetching news...</p>';

    const newsItems = await getNews();

    listContainer.innerHTML = '';

    if (newsItems.length === 0) {
        listContainer.innerHTML = '<div class="empty-state">No news added yet. Use the form above to add one.</div>';
        return;
    }

    newsItems.forEach(item => {
        const card = document.createElement('div');
        card.className = 'news-card';
        card.innerHTML = createNewsCardHtml(item, true);
        listContainer.appendChild(card);
    });
}

async function uploadFile(file) {
    const { url, key } = getSupabaseCredentials();
    if (!url || !key) return null;

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
    const filePath = `${fileName}`;

    try {
        const uploadUrl = `${url.replace(/\/$/, '')}/storage/v1/object/news-images/${filePath}`;
        const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`,
                'Content-Type': file.type || 'application/octet-stream',
                'x-upsert': 'true'
            },
            body: file
        });

        if (response.ok) {
            return `${url.replace(/\/$/, '')}/storage/v1/object/public/news-images/${filePath}`;
        } else {
            console.error("Upload failed", await response.text());
            return null;
        }
    } catch (e) {
        console.error("Upload error", e);
        return null;
    }
}

async function handleAddNews(e) {
    e.preventDefault();
    
    const titleObj = document.getElementById('news-title');
    const contentObj = document.getElementById('news-content');
    // const authorObj = document.getElementById('news-author'); // Removed
    const imageInput = document.getElementById('news-image');
    const videoInput = document.getElementById('news-video');
    const linkObj = document.getElementById('news-link');
    const pinObj = document.getElementById('publish-pin');
    const btn = document.getElementById('btn-add-news');

    if (!titleObj || !contentObj || !pinObj) return;

    const title = titleObj.value.trim();
    const content = contentObj.value.trim();
    // const author = authorObj ? authorObj.value.trim() : 'Admin'; // Old logic
    let link_url = linkObj ? linkObj.value.trim() : '';
    
    // Auto-fix link if it doesn't start with http/https
    if (link_url && !/^https?:\/\//i.test(link_url)) {
        link_url = 'https://' + link_url;
    }

    const pin = pinObj.value.trim();

    if (!title || !content) {
        alert('Please fill in title and content.');
        return;
    }
    
    if (!pin) {
        alert('Please enter a Publish PIN.');
        return;
    }

    // AUTH CHECK
    let role = '';
    let authorName = '';

    const hashedPin = await window.hashPassword(pin);

    if (hashedPin === window.ADMIN_PASSWORD_HASH) {
        role = 'admin';
        authorName = 'Admin';
    } else if (hashedPin === window.USER_PASSWORD_HASH) {
        role = 'user';
        authorName = 'User';
    } else {
        alert("Incorrect PIN. Please try again.");
        return;
    }

    // LIMIT CHECK FOR USER
    if (role === 'user') {
        try {
            const existingNews = await getNews();
            const userPosts = existingNews.filter(n => n.publisher_role === 'user').length;
            if (userPosts >= 5) {
                alert(`User limit reached! You have already published ${userPosts}/5 items.`);
                return;
            }
        } catch(e) {}
    }

    // Disable button
    const originalText = btn.textContent;
    btn.textContent = "Publishing...";
    btn.disabled = true;
    
    // Handle Files
    let image_url = '';
    let video_url = '';
    const imgFile = imageInput && imageInput.files ? imageInput.files[0] : null;
    const vidFile = videoInput && videoInput.files ? videoInput.files[0] : null;

    if (imgFile) {
        btn.textContent = "Uploading Image...";
        const uploadedUrl = await uploadFile(imgFile);
        if (uploadedUrl) image_url = uploadedUrl;
    }

    if (vidFile) {
        btn.textContent = "Uploading Video...";
        const uploadedUrl = await uploadFile(vidFile);
        if (uploadedUrl) video_url = uploadedUrl;
    }

    btn.textContent = "Saving News...";

    const newItem = {
        title,
        content,
        author: authorName, // Auto-set
        date: new Date().toISOString(),
        image_url,
        video_url,
        link_url,
        publisher_role: role
    };

    const success = await saveNews(newItem);

    if (success) {
        titleObj.value = '';
        contentObj.value = '';
        // if(authorObj) authorObj.value = ''; // Removed
        if(imageInput) imageInput.value = ''; 
        if(videoInput) videoInput.value = '';
        if(linkObj) linkObj.value = '';
        pinObj.value = ''; // Clear PIN
        
        await renderNewsAdmin();
        alert('News item published!');
    }

    btn.textContent = originalText;
    btn.disabled = false;
}

// --- Utilities ---

function escapeHtml(text) {
    if (!text) return '';
    return text.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function formatContent(text) {
    if (!text) return '';
    return escapeHtml(text).replace(/\n/g, '<br>');
}

// --- Clear All Logic ---

async function handleClearAllNews() {
    if (!confirm("⚠️ WARNING: This will delete ALL news items. This action cannot be undone.\n\nAre you sure?")) return;

    const pin = prompt("Please enter the ADMIN PIN to confirm deletion:");
    if (!pin) return;

    const hashedPin = await window.hashPassword(pin);
    if (hashedPin !== window.ADMIN_PASSWORD_HASH) {
        alert("❌ Access Denied: Incorrect PIN. Only Admin can clear all news.");
        return;
    }

    const { url, key } = getSupabaseCredentials();
    if (!url || !key) return;

    // Delete all rows
    try {
        const requestUrl = `${url.replace(/\/$/, '')}/rest/v1/news?id=neq.0`; // Delete where id != 0 (all)
        const response = await fetch(requestUrl, {
            method: 'DELETE',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`
            }
        });

        if (response.ok) {
            alert("✅ All news items have been deleted.");
            renderNewsAdmin();
        } else {
            alert("Error clearing news: " + await response.text());
        }
    } catch (e) {
        console.error(e);
        alert("Network Error");
    }
}

// --- Initialization ---

document.addEventListener('DOMContentLoaded', () => {
    // Determine which page we are on
    setupLightbox(); 

    if (document.getElementById('news-list-public')) {
        renderNewsPublic();
    }

    if (document.getElementById('news-list-admin')) {
        renderNewsAdmin();
        const addBtn = document.getElementById('btn-add-news');
        if (addBtn) {
            addBtn.addEventListener('click', handleAddNews);
        }
        
        const clearBtn = document.getElementById('btn-clear-all');
        if (clearBtn) {
            clearBtn.addEventListener('click', handleClearAllNews);
        }
    }
});

window.deleteNews = deleteNews;
