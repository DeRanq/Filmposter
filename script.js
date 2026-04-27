const SUPABASE_URL = 'https://lxzickpqscboazkcmyla.supabase.co'; //
const SUPABASE_KEY = 'sb_publishable_q8lO9gInrJ6j04dTsTZygg_NkddYDVi'; //

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY); //

const posterGrid    = document.getElementById('posterGrid'); //
const latestGrid    = document.getElementById('latestGrid'); //
const searchField   = document.getElementById('searchField'); //
const suggestionsBox = document.getElementById('suggestions'); //
const modal         = document.getElementById('posterModal'); //
const modalBody     = document.getElementById('modalBody'); //
const filterGenre   = document.getElementById('filterGenre'); //
const filterYear    = document.getElementById('filterYear'); //
const resetFilter   = document.getElementById('resetFilter'); //

const isMobile = () => window.innerWidth <= 600; //

/* =============================================
   Filter-Dropdowns befüllen (Optimiert)
   ============================================= */

async function ladeFilterOptionen() {
    // Wir laden nur Kategorien, die eine Verknüpfung in 'poster_categories' haben
    // Das '!inner' sorgt dafür, dass Genres ohne Poster automatisch aussortiert werden
    const { data: genres, error: genreError } = await supabaseClient
        .from('categories')
        .select('id, name, poster_categories!inner(poster_id)')
        .order('name');

    if (!genreError && genres) {
        // Falls ein Genre bei mehreren Postern vorkommt, filtern wir Duplikate in JS
        const uniqueGenres = [];
        const seenIds = new Set();
        
        genres.forEach(g => {
            if (!seenIds.has(g.id)) {
                uniqueGenres.push(g);
                seenIds.add(g.id);
            }
        });

        filterGenre.innerHTML = '<option value="">🎭 Alle Genres</option>';
        uniqueGenres.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.id;
            opt.textContent = g.name;
            filterGenre.appendChild(opt);
        });
    }

    // --- Jahre laden (bleibt wie es war) ---
    const { data: jahre } = await supabaseClient
        .from('posters')
        .select('release_year')
        .order('release_year', { ascending: false });

    if (jahre) {
        const unique = [...new Set(jahre.map(p => p.release_year).filter(Boolean))];
        filterYear.innerHTML = '<option value="">📅 Alle Jahre</option>';
        unique.forEach(year => {
            const opt = document.createElement('option');
            opt.value = year;
            opt.textContent = year;
            filterYear.appendChild(opt);
        });
    }
}

    // Jahre laden
    const { data: jahre } = await supabaseClient
        .from('posters')
        .select('release_year')
        .order('release_year', { ascending: false }); //

    if (jahre) {
        const unique = [...new Set(jahre.map(p => p.release_year).filter(Boolean))];
        filterYear.innerHTML = '<option value="">📅 Alle Jahre</option>';
        unique.forEach(year => {
            const opt = document.createElement('option');
            opt.value = year;
            opt.textContent = year;
            filterYear.appendChild(opt);
        });
    }
}

/* =============================================
   Genres für ein Poster holen
   ============================================= */

async function holeGenres(posterId) {
    try {
        const { data: links, error: linkError } = await supabaseClient
            .from('poster_categories')
            .select('category_id')
            .eq('poster_id', posterId); //

        if (linkError || !links || links.length === 0) return 'Nicht angegeben';

        const categoryIds = links.map(l => l.category_id);

        const { data: cats, error: catError } = await supabaseClient
            .from('categories')
            .select('name')
            .in('id', categoryIds); //

        if (catError || !cats || cats.length === 0) return 'Nicht angegeben';

        return cats.map(c => c.name).join(', ');
    } catch (e) {
        return 'Nicht angegeben';
    }
}

/* =============================================
   Modal öffnen
   ============================================= */

async function openModal(poster) {
    modalBody.innerHTML = `<p>Lädt Details...</p>`; //
    modal.style.display = 'block'; //

    const genreText = await holeGenres(poster.id);

    modalBody.innerHTML = `
        <img src="${poster.image_url}" alt="${poster.title}">
        <h2 style="margin: 10px 0;">${poster.title}</h2>
        <div style="text-align: left; background: #222; padding: 15px; border-radius: 10px; font-size: 0.9rem;">
            <p><strong>📅 Jahr:</strong> ${poster.release_year || 'Unbekannt'}</p>
            <p><strong>🎭 Genre:</strong> ${genreText}</p>
            <hr style="border: 0; border-top: 1px solid #444; margin: 10px 0;">
            <p><strong>📝 Beschreibung:</strong><br>${poster.description || 'Keine Beschreibung vorhanden.'}</p>
        </div>
    `; //
}

/* =============================================
   Neueste Poster laden
   ============================================= */

async function ladeNeueste() {
    const limit = isMobile() ? 3 : 5; //

    const { data, error } = await supabaseClient
        .from('posters')
        .select('*')
        .order('id', { ascending: false })
        .limit(limit); //

    if (!error && data) {
        latestGrid.innerHTML = '';
        data.forEach(poster => {
            const card = document.createElement('div');
            card.className = 'poster-card';
            card.innerHTML = `
                <div class="badge-new">NEU</div>
                <img src="${poster.image_url}">
                <h3>${poster.title}</h3>
            `; //
            card.onclick = () => openModal(poster);
            latestGrid.appendChild(card);
        });
    }
}

/* =============================================
   Alle Poster laden (Suche + Filter)
   ============================================= */

async function ladeAllePoster() {
    const suchbegriff  = searchField.value.trim(); //
    const genreId      = filterGenre.value; //
    const jahr         = filterYear.value; //

    let erlaubtePosterIds = null;

    if (genreId) {
        const { data: links } = await supabaseClient
            .from('poster_categories')
            .select('poster_id')
            .eq('category_id', genreId); //

        if (links && links.length > 0) {
            erlaubtePosterIds = links.map(l => l.poster_id);
        } else {
            posterGrid.innerHTML = '<p style="color:#888; text-align:center; padding: 20px;">Keine Poster gefunden.</p>';
            return;
        }
    }

    let query = supabaseClient
        .from('posters')
        .select('*')
        .order('title'); //

    if (suchbegriff) {
        query = query.ilike('title', `%${suchbegriff}%`); //
    }

    if (jahr) {
        query = query.eq('release_year', parseInt(jahr)); //
    }

    if (erlaubtePosterIds) {
        query = query.in('id', erlaubtePosterIds); //
    }

    const { data, error } = await query;

    if (!error && data) {
        posterGrid.innerHTML = '';
        if (data.length === 0) {
            posterGrid.innerHTML = '<p style="color:#888; text-align:center; padding: 20px;">Keine Poster gefunden.</p>';
            return;
        }
        data.forEach(poster => {
            const card = document.createElement('div');
            card.className = 'poster-card';
            card.innerHTML = `
                <img src="${poster.image_url}">
                <h3>${poster.title}</h3>
            `; //
            card.onclick = () => openModal(poster);
            posterGrid.appendChild(card);
        });
    }
}

/* =============================================
   Event Listener
   ============================================= */

searchField.addEventListener('input', async (e) => {
    const wert = e.target.value;
    if (wert.length < 2) {
        suggestionsBox.style.display = 'none';
        ladeAllePoster();
        return;
    }
    const { data } = await supabaseClient
        .from('posters')
        .select('title')
        .ilike('title', `%${wert}%`)
        .limit(5); //

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

filterGenre.addEventListener('change', ladeAllePoster); //
filterYear.addEventListener('change', ladeAllePoster); //

resetFilter.addEventListener('click', () => {
    filterGenre.value = '';
    filterYear.value = '';
    searchField.value = '';
    suggestionsBox.style.display = 'none';
    ladeAllePoster();
}); //

document.querySelector('.close-button').onclick = () => {
    modal.style.display = 'none';
}; //

window.onclick = (e) => {
    if (e.target === modal) modal.style.display = 'none';
    if (e.target !== searchField) suggestionsBox.style.display = 'none';
}; //

/* =============================================
   Init
   ============================================= */
ladeFilterOptionen(); //
ladeNeueste(); //
ladeAllePoster(); //
