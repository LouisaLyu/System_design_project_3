let readyStatus = document.querySelector('#readyStatus')
let notReadyStatus = document.querySelector('#notReadyStatus')
let myForm = document.querySelector('#myForm')
let contentArea = document.querySelector('#contentArea')
let formDialog = document.querySelector('#formDialog')
let createButton = document.querySelector('#createButton')
let saveButton = document.querySelector('#saveButton')
let cancelButton = document.querySelector('#cancelButton')
let formHeading = document.querySelector('.modal-header h2')

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

// Helper: simple perceived brightness (0-255)
const getBrightness = ({ r, g, b }) => {
    return (r * 299 + g * 587 + b * 114) / 1000
}

// Parse CSS color strings like 'rgb(51, 51, 51)' or 'rgba(51,51,51,1)' or hex '#333' '#ffffff'
const parseCssColor = (str) => {
    if (!str) return null
    str = str.trim()
    if (str.startsWith('rgb')) {
        const parts = str.replace(/rgba?\(|\)/g, '').split(',').map(s => s.trim())
        return { r: Number(parts[0]), g: Number(parts[1]), b: Number(parts[2]) }
    }
    if (str.startsWith('#')) return hexToRgb(str)
    return null
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
    await saveItem(data)
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
        getData()
    }
    catch (err) {
        console.error('Save error:', err)
        alert('An error occurred while saving')
    }
}


// Edit item - populate form with existing data
const editItem = (data) => {
    console.log('Editing:', data)

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
            getData()
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


const calendarWidget = (date) => {
    if (!date) return ''
    const month = new Date(date).toLocaleString("en-CA", { month: 'short', timeZone: "UTC" })
    const day = new Date(date).toLocaleString("en-CA", { day: '2-digit', timeZone: "UTC" })
    const year = new Date(date).toLocaleString("en-CA", { year: 'numeric', timeZone: "UTC" })
    return ` <div class="calendar">
                <div class="born">...</div>
                <div class="month">${month}</div>
                <div class="day">${day}</div> 
                <div class="year">${year}</div>
            </div>`

}


// Helper function for the layout
const calcGridSpans = () =>{
    const grid = document.querySelector('#contentArea');
    const rowHeight = parseInt(window.getComputedStyle(grid).getPropertyValue('grid-auto-rows'));
    const rowGap = parseInt(window.getComputedStyle(grid).getPropertyValue('gap'));
    const items = grid.querySelectorAll('.item-card'); 

  items.forEach(item => {
    const contentHeight = item.getBoundingClientRect().height;
    const rowSpan = Math.ceil((contentHeight + rowGap) / (rowHeight + rowGap));
    item.style.gridRowEnd = `span ${rowSpan}`;
  });
}

// Render a single item
const renderItem = (item) => {
    const div = document.createElement('div')
    div.classList.add('item-card')
    div.setAttribute('data-id', item.id)
    div.style.margin = '10px 20px';
    div.style.width = '100%';
    div.style.wordBreak = 'break-word';
    // Apply the mood color to the card background instead of an icon
    div.style.background = item.moodColor ? item.moodColor : ''

    const template = /*html*/`  
    <div class="item-heading">
        <h3> ${item.title || 'Untitled'} </h3>
    </div>

    <div class="item-subinfo">
        ${item.topic ? `<div class="topic">Topic: ${item.topic}</div>` : ''}
        ${(item.tags || []).length ? `<div class="tags">Tags: ${(item.tags || []).map(t => `<span class="tag">${t}</span>`).join(' ')}</div>` : ''}
    </div>

    <div class="item-info"> 
        <div class="excerpt" style="width: 80%;">
            <p>${item.body}</p>
        </div>
         ${calendarWidget(item.entryDate)}
    </div>

    <div class="item-actions">
        <button class="edit-btn">Edit</button>
        <button class="delete-btn">Delete</button>
    </div>
    `
    div.innerHTML = DOMPurify.sanitize(template);

    // Temporarily append to DOM while computing contrast
    contentArea.appendChild(div)
    try {
        const rgbBg = hexToRgb(item.moodColor)
        if (rgbBg) {
            // WCAG contrast helpers
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

            const white = { r: 255, g: 255, b: 255 }
            const contrastWithWhite = contrastRatio(rgbBg, white)

            // WCAG AA for normal text requires 4.5:1 contrast
            if (contrastWithWhite >= 4.5) {
                div.classList.add('dark-foreground')
            } else {
                div.classList.remove('dark-foreground')
            }
        } else {
            div.classList.remove('dark-foreground')
        }
    } finally {
        // remove temporary placement
        if (div.parentElement === contentArea) contentArea.removeChild(div)
    }

    // Add event listeners to buttons
    div.querySelector('.edit-btn').addEventListener('click', () => editItem(item))
    div.querySelector('.delete-btn').addEventListener('click', () => deleteItem(item.id))

    return div
}

// fetch items from API endpoint and populate the content div
const getData = async () => {
    try {
        const response = await fetch('/data')

        if (response.ok) {
            readyStatus.style.display = 'block'
            notReadyStatus.style.display = 'none'

            const data = await response.json()
            console.log('Fetched data:', data)

            if (data.length == 0) {
                contentArea.innerHTML = '<p><i>No data found in the database.</i></p>'
                return
            }
            else {
                contentArea.innerHTML = ''
                data.forEach(item => {
                    const itemDiv = renderItem(item)
                    contentArea.appendChild(itemDiv)
                })

                calcGridSpans();
            }
        }
        else {
            // If the request failed, show the "not ready" status
            // to inform users that there may be a database connection issue
            notReadyStatus.style.display = 'block'
            readyStatus.style.display = 'none'
            createButton.style.display = 'none'
            contentArea.style.display = 'none'
        }
    } catch (error) {
        console.error('Error fetching data:', error)
        notReadyStatus.style.display = 'block'
    }
}

// Revert to the default form title on reset
myForm.addEventListener('reset', () => formHeading.textContent = '📝 New Journal Entry')

// Open dialog when create button clicked
createButton.addEventListener('click', () => {
    myForm.reset()
    if (formDialog && typeof formDialog.showModal === 'function') formDialog.showModal()
})

// Close dialog when cancel button clicked
if (cancelButton) cancelButton.addEventListener('click', () => {
    if (formDialog && typeof formDialog.close === 'function') formDialog.close()
})

// Save button submits the form
if (saveButton) saveButton.addEventListener('click', () => myForm.requestSubmit())

// Load initial data
getData()


let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(calcGridSpans, 150);
})