const SUPABASE_URL = 'https://lxzickpqscboazkcmyla.supabase.co';
const SUPABASE_KEY = 'sb_publishable_q8lO9gInrJ6j04dTsTZygg_NkddYDVi';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const posterGrid      = document.getElementById('posterGrid');
const latestGrid      = document.getElementById('latestGrid');
const latestSection   = document.getElementById('latestSection');
const latestSeparator = document.getElementById('latestSeparator');
const allePosterTitle = document.getElementById('allePosterTitle');
const filterGenre     = document.getElementById('filterGenre');
const filterYear      = document.getElementById('filterYear');
const searchField     = document.getElementById('searchField');
const suggestionsBox  = document.getElementById('suggestions');
const sideMenu        = document.getElementById('sideMenu');
const modal           = document.getElementById('posterModal');
const modalBody       = document.getElementById('modalBody');

/* ================================================
   Hilfsfunktion: ist irgendein Filter/Suche aktiv?
   ================================================ */
function filterAktiv() {
    return searchField.value.trim() !== '' || filterGenre.value !== '' || filterYear.value !== '';
}

/* ================================================
   "Neu im Archiv" ein- oder ausblenden
   ================================================ */
function aktualisiereLatestSichtbarkeit() {
    const verstecken = filterAktiv();
    latestSection.style.display   = verstecken ? 'none' : '';
    latestSeparator.style.display = verstecken ? 'none' : '';
    allePosterTitle.textContent   = verstecken ? 'Suchergebnisse' : 'Alle Filme';
}

/* ================================================
   Genres für ein Poster holen
   ================================================ */
async function holeGenres(posterId) {
    try {
        const { data: links, error: linkError } = await supabaseClient
            .from('poster_categories')
            .select('category_id')
            .eq('poster_id', posterId);

        if (linkError || !links || links.length === 0) return 'Nicht angegeben';

        const categoryIds = links.map(l => l.category_id);

        const { data: cats, error: catError } = await supabaseClient
            .from('categories')
            .select('name')
            .in('id', categoryIds);

        if (catError || !cats || cats.length === 0) return 'Nicht angegeben';

        return cats.map(c => c.name).join(', ');
    } catch (e) {
        return 'Nicht angegeben';
    }
}

/* ================================================
   Modal öffnen – besseres Layout
   ================================================ */
async function openModal(poster) {
    modalBody.innerHTML = `<p class="modal-loading">Lade Infos...</p>`;
    modal.style.display = 'block';

    const genreText = await holeGenres(poster.id);

    modalBody.innerHTML = `
        <div class="modal-poster-wrap">
            <img src="${poster.image_url}" alt="${poster.title}" class="modal-poster-img">
        </div>
        <h2 class="modal-title">${poster.title}</h2>
        <div class="modal-meta">
            <div class="modal-meta-item">
                <span class="meta-label">📅 Jahr</span>
                <span class="meta-value">${poster.release_year || 'Unbekannt'}</span>
            </div>
            <div class="modal-meta-item">
                <span class="meta-label">🎬 Genre</span>
                <span class="meta-value">${genreText}</span>
            </div>
        </div>
        <div class="modal-desc">
            <p class="modal-desc-label">📝 Beschreibung</p>
            <p class="modal-desc-text">${poster.description || 'Keine Beschreibung vorhanden.'}</p>
        </div>
    `;
}

document.getElementById('modalClose').onclick = () => modal.style.display = 'none';
window.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };

/* ================================================
   Seitenmenü
   ================================================ */
document.getElementById('menuButton').onclick = (e) => {
    e.stopPropagation();
    sideMenu.classList.add('open');
};
document.getElementById('closeMenu').onclick = () => sideMenu.classList.remove('open');
document.addEventListener('click', (e) => {
    if (!sideMenu.contains(e.target) && e.target !== document.getElementById('menuButton')) {
        sideMenu.classList.remove('open');
    }
});

/* ================================================
   Karussell-Pfeile
   ================================================ */
document.getElementById('posterPrev').onclick = () => posterGrid.scrollLeft -= 400;
document.getElementById('posterNext').onclick = () => posterGrid.scrollLeft += 400;

/* ================================================
   Filter-Dropdowns befüllen
   ================================================ */
async function ladeFilterOptionen() {
    const { data: links } = await supabaseClient
        .from('poster_categories')
        .select('category_id');

    if (links && links.length > 0) {
        const usedIds = [...new Set(links.map(l => l.category_id))];
        const { data: genres } = await supabaseClient
            .from('categories')
            .select('id, name')
            .in('id', usedIds)
            .order('name');

        if (genres) {
            filterGenre.innerHTML = '<option value="">Alle Genres</option>';
            genres.forEach(g => {
                const opt = document.createElement('option');
                opt.value = g.id;
                opt.textContent = g.name;
                filterGenre.appendChild(opt);
            });
        }
    }

    const { data: jahre } = await supabaseClient
        .from('posters')
        .select('release_year')
        .order('release_year', { ascending: false });

    if (jahre) {
        const unique = [...new Set(jahre.map(p => p.release_year).filter(Boolean))];
        unique.forEach(y => {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            filterYear.appendChild(opt);
        });
    }
}

/* ================================================
   Neueste Poster (3 mobil, 5 desktop)
   ================================================ */
async function ladeNeueste() {
    const limit = window.innerWidth <= 600 ? 3 : 5;

    const { data } = await supabaseClient
        .from('posters')
        .select('*')
        .order('id', { ascending: false })
        .limit(limit);

    if (data) {
        latestGrid.innerHTML = '';
        data.forEach(poster => {
            const card = document.createElement('div');
            card.className = 'poster-card';
            card.innerHTML = `
                <div class="badge-new">NEU</div>
                <img src="${poster.image_url}" alt="${poster.title}">
                <h3>${poster.title}</h3>
            `;
            card.onclick = () => openModal(poster);
            latestGrid.appendChild(card);
        });
    }
}

/* ================================================
   Alle Poster laden
   ================================================ */
async function ladeAllePoster() {
    aktualisiereLatestSichtbarkeit();

    const suchbegriff = searchField.value.trim();
    const genreId     = filterGenre.value;
    const jahr        = filterYear.value;

    let erlaubtePosterIds = null;
    if (genreId) {
        const { data: links } = await supabaseClient
            .from('poster_categories')
            .select('poster_id')
            .eq('category_id', genreId);

        if (links && links.length > 0) {
            erlaubtePosterIds = links.map(l => l.poster_id);
        } else {
            posterGrid.innerHTML = '<p class="no-results">Keine Poster für dieses Genre gefunden.</p>';
            return;
        }
    }

    let query = supabaseClient.from('posters').select('*').order('title');
    if (suchbegriff)       query = query.ilike('title', `%${suchbegriff}%`);
    if (jahr)              query = query.eq('release_year', parseInt(jahr));
    if (erlaubtePosterIds) query = query.in('id', erlaubtePosterIds);

    const { data, error } = await query;

    posterGrid.innerHTML = '';

    if (error || !data || data.length === 0) {
        posterGrid.innerHTML = '<p class="no-results">Keine Poster gefunden.</p>';
        return;
    }

    data.forEach(poster => {
        const card = document.createElement('div');
        card.className = 'poster-card';
        card.innerHTML = `
            <img src="${poster.image_url}" alt="${poster.title}">
            <h3>${poster.title}</h3>
        `;
        card.onclick = () => openModal(poster);
        posterGrid.appendChild(card);
    });
}

/* ================================================
   Suche mit Vorschlägen
   ================================================ */
searchField.addEventListener('input', async () => {
    const wert = searchField.value.trim();
    ladeAllePoster();

    if (wert.length < 2) {
        suggestionsBox.style.display = 'none';
        return;
    }

    const { data } = await supabaseClient
        .from('posters')
        .select('title')
        .ilike('title', `%${wert}%`)
        .limit(6);

    if (data && data.length > 0) {
        suggestionsBox.innerHTML = '';
        data.forEach(item => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.textContent = item.title;
            div.onclick = () => {
                searchField.value = item.title;
                suggestionsBox.style.display = 'none';
                ladeAllePoster();
            };
            suggestionsBox.appendChild(div);
        });
        suggestionsBox.style.display = 'block';
    } else {
        suggestionsBox.style.display = 'none';
    }
});

document.addEventListener('click', (e) => {
    if (e.target !== searchField) suggestionsBox.style.display = 'none';
});

/* ================================================
   Filter-Events
   ================================================ */
filterGenre.addEventListener('change', ladeAllePoster);
filterYear.addEventListener('change', ladeAllePoster);

document.getElementById('resetFilter').onclick = () => {
    searchField.value = '';
    filterGenre.value = '';
    filterYear.value  = '';
    suggestionsBox.style.display = 'none';
    ladeAllePoster();
};

/* ================================================
   Init
   ================================================ */
ladeFilterOptionen();
ladeNeueste();
ladeAllePoster();
