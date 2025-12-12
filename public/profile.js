let myForm = document.querySelector('#myForm')
let contentArea = document.querySelector('#contentArea')
let formDialog = document.querySelector('#formDialog')
let createButton = document.querySelector('#createButton')
let saveButton = document.querySelector('#saveButton')
let cancelButton = document.querySelector('#cancelButton')
let formHeading = document.querySelector('.modal-header h2')
let editingId = null // Track the currently editing item ID

// Helper: convert hex color (#rrggbb or #rgb) to {r,g,b}
const hexToRgb = (hex) => {
    if (!hex) return null
    const cleaned = hex.replace('#', '').trim()
    if (cleaned.length === 3) {
        const r = cleaned[0] + cleaned[0]
        const g = cleaned[1] + cleaned[1]
        const b = cleaned[2] + cleaned[2]
        return { r: parseInt(r, 16), g: parseInt(g, 16), b: parseInt(b, 16) }
    }
    if (cleaned.length !== 6) return null
    return {
        r: parseInt(cleaned.substring(0, 2), 16),
        g: parseInt(cleaned.substring(2, 4), 16),
        b: parseInt(cleaned.substring(4, 6), 16)
    }
}

// Helper: calculate WCAG contrast ratio
const toLinear = (c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

const relLuminance = (rgb) => {
    const R = toLinear(rgb.r)
    const G = toLinear(rgb.g)
    const B = toLinear(rgb.b)
    return 0.2126 * R + 0.7152 * G + 0.0722 * B
}

const contrastRatio = (a, b) => {
    const L1 = relLuminance(a)
    const L2 = relLuminance(b)
    const lighter = Math.max(L1, L2)
    const darker = Math.min(L1, L2)
    return (lighter + 0.05) / (darker + 0.05)
}

// Calendar widget helper
const calendarWidget = (date) => {
    if (!date) return ''
    const month = new Date(date).toLocaleString("en-CA", { month: 'short', timeZone: "UTC" })
    const day = new Date(date).toLocaleString("en-CA", { day: '2-digit', timeZone: "UTC" })
    const year = new Date(date).toLocaleString("en-CA", { year: 'numeric', timeZone: "UTC" })
    return `<div class="calendar">
                <div class="born">...</div>
                <div class="month">${month}</div>
                <div class="day">${day}</div>
                <div class="year">${year}</div>
            </div>`
}

// Calculate grid row spans based on card height
const calcGridSpans = () => {
    const grid = document.querySelector('#postsContent');
    if (!grid) return;
    const rowHeight = parseInt(window.getComputedStyle(grid).getPropertyValue('grid-auto-rows'));
    const rowGap = parseInt(window.getComputedStyle(grid).getPropertyValue('gap'));
    const items = grid.querySelectorAll('.item-card');

    items.forEach(item => {
        const contentHeight = item.getBoundingClientRect().height;
        const rowSpan = Math.ceil((contentHeight + rowGap) / (rowHeight + rowGap));
        item.style.gridRowEnd = `span ${rowSpan}`;
    });
}

// Render a single post card
const renderPostCard = (post) => {
    const div = document.createElement('div')
    div.classList.add('item-card')
    div.setAttribute('data-id', post.id)
    div.style.margin = '10px 20px';
    div.style.width = '100%';
    div.style.wordBreak = 'break-word';
    div.style.background = post.moodColor ? post.moodColor : ''

    const template = `
        <div class="item-heading">
            <h3>${post.title || 'Untitled'}</h3>
        </div>

        <div class="item-subinfo">
            ${post.topic ? `<div class="topic">Topic: ${post.topic}</div>` : ''}
            ${(post.tags || []).length ? `<div class="tags">Tags: ${(post.tags || []).map(t => `<span class="tag">${t}</span>`).join(' ')}</div>` : ''}
        </div>

        <div class="item-info">
                <div class="excerpt" style="width: 80%;">
                <p>${post.body}</p>
            </div>
            ${calendarWidget(post.entryDate)}
        </div>

        <div class="item-actions">
        <button class="edit-btn">Edit</button>
        <button class="delete-btn">Delete</button>
        </div>
    `
    div.innerHTML = template;

    // Check contrast for dark foreground
    if (post.moodColor) {
        const rgbBg = hexToRgb(post.moodColor)
        if (rgbBg) {
            const white = { r: 255, g: 255, b: 255 }
            const contrastWithWhite = contrastRatio(rgbBg, white)
            if (contrastWithWhite >= 4.5) {
                div.classList.add('dark-foreground')
            }
        }
    }

    const editBtn = div.querySelector('.edit-btn')
    const deleteBtn = div.querySelector('.delete-btn')

    editBtn.addEventListener('click', async () => {
        editItem(post)
    })
    deleteBtn.addEventListener('click', async () => {
        deleteItem(post.id)
    })

    return div
}


// Get DOM elements
const postsContent = document.getElementById('postsContent');

// Load and render user's posts
const loadUserPosts = async () => {
    if (!postsContent) return; // Only run on profile page

    try {
        postsContent.innerHTML = '<div class="loading">Loading your posts...</div>';

        // Fetch user profile first to get userId
        const profileRes = await fetch('/profile');
        if (!profileRes.ok) throw new Error('Failed to fetch profile');

        const user = await profileRes.json();
        const userId = user.sub;

        // Fetch user's posts via search endpoint with userId filter
        const searchRes = await fetch(`/search?userId=${encodeURIComponent(userId)}`);
        if (!searchRes.ok) throw new Error('Failed to fetch posts');

        const userPosts = await searchRes.json();

        if (userPosts.length === 0) {
            postsContent.innerHTML = '<div class="no-posts">You haven\'t created any journal entries yet. Start by going back to the main page!</div>';
            return;
        }

        // Clear and render posts using masonry layout
        postsContent.innerHTML = '';
        userPosts.forEach(post => {
            const cardDiv = renderPostCard(post);
            postsContent.appendChild(cardDiv);
        });

        // Calculate grid spans for masonry effect
        calcGridSpans();
    } catch (err) {
        console.error('Error loading user posts:', err);
        if (postsContent) {
            postsContent.innerHTML = '<div class="error">Error loading your posts.</div>';
        }
    }
};


// Get form data and process each type of input
// Prepare the data as JSON with a proper set of types
// e.g. Booleans, Numbers, Dates
const getFormData = () => {
    // FormData gives a baseline representation of the form
    // with all fields represented as strings
    const formData = new FormData(myForm)
    const json = Object.fromEntries(formData)

    // Handle checkboxes, dates, and numbers
    myForm.querySelectorAll('input').forEach(el => {
        const value = json[el.name]
        const isEmpty = !value || value.trim() === ''

        // Represent checkboxes as a Boolean value (true/false)
        if (el.type === 'checkbox') {
            json[el.name] = el.checked
        }
        // Represent number and range inputs as actual numbers
        else if (el.type === 'number' || el.type === 'range') {
            json[el.name] = isEmpty ? null : Number(value)
        }
        // Represent all date inputs in ISO-8601 DateTime format
        else if (el.type === 'date') {
            json[el.name] = isEmpty ? null : new Date(value).toISOString()
        }
    })
    return json
}


// listen for form submissions  
myForm.addEventListener('submit', async event => {
    // prevent the page from reloading when the form is submitted.
    event.preventDefault()
    const data = getFormData()
    // Normalize tags: comma-separated string -> array
    if (data.tags && typeof data.tags === 'string') {
        data.tags = data.tags.split(',').map(s => s.trim()).filter(Boolean)
    } else {
        data.tags = []
    }
    // NEW: if we're NOT editing, make sure we don't send an id
    if (!editingId) {
        delete data.id
    }
    await saveItem(data)
    editingId = null
    myForm.reset()
    if (formDialog && typeof formDialog.close === 'function') formDialog.close()
})


// Save item (Create or Update)
const saveItem = async (data) => {
    console.log('Saving:', data)

    // Determine if this is an update or create
    const endpoint = data.id ? `/data/${data.id}` : '/data'
    const method = data.id ? "PUT" : "POST"

    const options = {
        method: method,
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    }

    try {
        const response = await fetch(endpoint, options)

        if (!response.ok) {
            try {
                const errorData = await response.json()
                console.error('Error:', errorData)
                alert(errorData.error || response.statusText)
            }
            catch (err) {
                console.error(response.statusText)
                alert('Failed to save: ' + response.statusText)
            }
            return
        }

        const result = await response.json()
        console.log('Saved:', result)


        // Refresh the data list
        loadUserPosts()
    }
    catch (err) {
        console.error('Save error:', err)
        alert('An error occurred while saving')
    }
}


// Edit item - populate form with existing data
const editItem = (data) => {
    console.log('Editing:', data)

    editingId = data.id // Set the currently editing item ID

    // Populate the form with data to be edited
    Object.keys(data).forEach(field => {
        const element = myForm.elements[field]
        if (element) {
            if (element.type === 'checkbox') {
                element.checked = data[field]
            } else if (element.type === 'date') {
                // Extract yyyy-mm-dd from ISO date string (avoids timezone issues)
                element.value = data[field] ? data[field].substring(0, 10) : ''
            } else {
                element.value = data[field]
            }
        }
    })

    // Update the heading to indicate edit mode
    formHeading.textContent = '📝 Edit Entry'

    // Show the dialog
    if (formDialog && typeof formDialog.showModal === 'function') formDialog.showModal()
}

// Delete item
const deleteItem = async (id) => {
    if (!confirm('Are you sure you want to delete this entry?')) {
        return
    }

    const endpoint = `/data/${id}`
    const options = { method: "DELETE" }

    try {
        const response = await fetch(endpoint, options)

        if (response.ok) {
            const result = await response.json()
            console.log('Deleted:', result)
            // Refresh the data list
            loadUserPosts()
        }
        else {
            const errorData = await response.json()
            alert(errorData.error || 'Failed to delete item')
        }
    } catch (error) {
        console.error('Delete error:', error)
        alert('An error occurred while deleting')
    }
}


// Load posts when page loads
document.addEventListener('DOMContentLoaded', loadUserPosts);


// Revert to the default form title on reset
myForm.addEventListener('reset', () => formHeading.textContent = '📝 New Journal Entry')




// Open dialog when create button clicked (require login first)
createButton.addEventListener('click', async () => {
    editingId = null // Clear the currently editing item ID
    myForm.reset()
    if (formDialog && typeof formDialog.showModal === 'function') formDialog.showModal()
})

// Close dialog when cancel button clicked
if (cancelButton) cancelButton.addEventListener('click', () => {
    if (formDialog && typeof formDialog.close === 'function') formDialog.close()
})

// Save button submits the form
if (saveButton) saveButton.addEventListener('click', () => myForm.requestSubmit())

// --- Live updates from the server (SSE) ---

const applyServerChangeOnProfile = () => {
    const previousScroll = window.scrollY

    loadUserPosts()
        .then(() => {
            window.scrollTo(0, previousScroll)
        })
        .catch(err => {
            console.error('Error refreshing profile after change:', err)
        })
}

if (typeof EventSource !== 'undefined') {
    const events = new EventSource('/events')

    events.addEventListener('message', (event) => {
        if (!event.data) return

        let payload
        try {
            payload = JSON.parse(event.data)
        } catch (e) {
            console.warn('Unable to parse SSE payload on profile page', e)
            return
        }

        if (payload.type !== 'journal-change') return

        // For simplicity, always refresh – it's cheap compared to the UX benefit
        applyServerChangeOnProfile()
    })

    events.addEventListener('error', (err) => {
        console.warn('EventSource error on profile page:', err)
    })
}


// Recalculate grid spans on resize
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(calcGridSpans, 150);
});

