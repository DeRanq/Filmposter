const SUPABASE_URL = 'https://lxzickpqscboazkcmyla.supabase.co';
const SUPABASE_KEY = 'sb_publishable_q8lO9gInrJ6j04dTsTZygg_NkddYDVi';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const posterGrid = document.getElementById('posterGrid');
const latestGrid = document.getElementById('latestGrid');
const searchField = document.getElementById('searchField');
const suggestionsBox = document.getElementById('suggestions');
const modal = document.getElementById('posterModal');
const modalBody = document.getElementById('modalBody');

const isMobile = () => window.innerWidth <= 600;

/**
 * Holt Genres für ein Poster
 */
async function holeGenres(posterId) {
    try {
        // Erst die category_ids aus der Junction-Tabelle holen
        const { data: links, error: linkError } = await supabaseClient
            .from('poster_categories')
            .select('category_id')
            .eq('poster_id', posterId);

        if (linkError || !links || links.length === 0) {
            return 'Nicht angegeben';
        }

        const categoryIds = links.map(l => l.category_id);

        // Dann die Namen aus der Kategorien-Tabelle holen
        const { data: cats, error: catError } = await supabaseClient
            .from('categories')
            .select('name')
            .in('id', categoryIds);

        if (catError || !cats || cats.length === 0) {
            return 'Nicht angegeben';
        }

        return cats.map(c => c.name).join(', ');
    } catch (e) {
        return 'Nicht angegeben';
    }
}

/**
 * Öffnet das Modal mit Bild, Titel, Jahr, Beschreibung und Genre
 */
async function openModal(poster) {
    modalBody.innerHTML = `<p>Lädt Details...</p>`;
    modal.style.display = "block";

    const genreText = await holeGenres(poster.id);

    modalBody.innerHTML = `
        <img src="${poster.image_url}" alt="${poster.title}">
        <h2 style="margin: 10px 0;">${poster.title}</h2>

        <div style="text-align: left; background: #222; padding: 15px; border-radius: 10px; font-size: 0.9rem;">
            <p><strong>📅 Jahr:</strong> ${poster.release_year || 'Unbekannt'}</p>
            <p><strong>🎭 Genre:</strong> ${genreText}</p>

            <hr style="border: 0; border-top: 1px solid #444; margin: 10px 0;">

            <p><strong>📝 Beschreibung:</strong><br>
            ${poster.description || 'Keine Beschreibung vorhanden.'}</p>
        </div>
    `;
}

/**
 * Neueste Poster laden – 3 auf Handy, 5 auf Desktop
 */
async function ladeNeueste() {
    const limit = isMobile() ? 3 : 5;

    const { data, error } = await supabaseClient
        .from('posters')
        .select('*')
        .order('id', { ascending: false })
        .limit(limit);

    if (!error && data) {
        latestGrid.innerHTML = '';

        data.forEach(poster => {
            const card = document.createElement('div');
            card.className = 'poster-card';

            card.innerHTML = `
                <div class="badge-new">NEU</div>
                <img src="${poster.image_url}">
                <h3>${poster.title}</h3>
            `;

            card.onclick = () => openModal(poster);
            latestGrid.appendChild(card);
        });
    }
}

/**
 * Alle Poster laden (optional mit Suche)
 */
async function ladeAllePoster(suchbegriff = '') {
    let query = supabaseClient
        .from('posters')
        .select('*')
        .order('title');

    if (suchbegriff) {
        query = query.ilike('title', `%${suchbegriff}%`);
    }

    const { data, error } = await query;

    if (!error && data) {
        posterGrid.innerHTML = '';

        data.forEach(poster => {
            const card = document.createElement('div');
            card.className = 'poster-card';

            card.innerHTML = `
                <img src="${poster.image_url}">
                <h3>${poster.title}</h3>
            `;

            card.onclick = () => openModal(poster);
            posterGrid.appendChild(card);
        });
    }
}

/**
 * Suche mit Vorschlägen
 */
searchField.addEventListener('input', async (e) => {
    const wert = e.target.value;

    if (wert.length < 2) {
        suggestionsBox.style.display = 'none';

        if (wert.length === 0) {
            ladeAllePoster();
        }
        return;
    }

    const { data } = await supabaseClient
        .from('posters')
        .select('title')
        .ilike('title', `%${wert}%`)
        .limit(5);

    if (data && data.length > 0) {
        suggestionsBox.innerHTML = '';

        data.forEach(item => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.textContent = item.title;

            div.onclick = () => {
                searchField.value = item.title;
                suggestionsBox.style.display = 'none';
                ladeAllePoster(item.title);
            };

            suggestionsBox.appendChild(div);
        });

        suggestionsBox.style.display = 'block';
    }
});

/**
 * Modal schließen
 */
document.querySelector('.close-button').onclick = () => {
    modal.style.display = "none";
};

window.onclick = (e) => {
    if (e.target === modal) {
        modal.style.display = "none";
    }

    if (e.target !== searchField) {
        suggestionsBox.style.display = 'none';
    }
};

// Initiale Daten laden
ladeNeueste();
ladeAllePoster();