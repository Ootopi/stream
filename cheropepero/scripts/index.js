import api from './api.js'
import dom from './ui.js'

const params = new URLSearchParams(window.location.search)
const campaign_id = params.get('campaign')
const donors_per_request = 20
const polling_rate = 1000

let goal //= 10000
let offset // = -7851.60
let skip_entries = 0 //48

function update() {
    if(updating) return
    last_update = Date.now()
    updating = true
    dom.update_donations()
    api.fetch_campaign_info(campaign_id)
        .then(latest_campaign => {
            campaign = latest_campaign
            if(previous_total_donors == campaign.total_donors) return
            if(previous_total_donors != campaign.total_donors) on_funded_change(campaign, campaign.total_donors - (previous_total_donors ?? 0), previous_total_donors == undefined)
            previous_total_donors = campaign.total_donors
        })
        .then(() => {
            updating = false
            setTimeout(update, polling_rate)
        })
}

function on_funded_change(campaign, changes, first_load) {
    console.log(campaign)
    console.info(`[${(new Date()).toLocaleString('en-GB')}] ${campaign.percentage.toFixed(0)}%: ${campaign.funded.currency_symbol}${campaign.funded.amount} of ${campaign.target.currency_symbol}${campaign.target.amount} raised by ${campaign.total_donors} donors`)
    console.info(`[${(new Date()).toLocaleString('en-GB')}] ${changes} new donors`)
    const pages = Math.ceil(changes / donors_per_request)
    console.info(`[${(new Date()).toLocaleString('en-GB')}] Fetching ${pages} pages`)

    const funded = parseFloat(campaign.funded.amount.replace(',', '')) + (offset ?? 0)
    const target = goal ?? parseFloat(campaign.target.amount.replace(',', ''))
    const percentage = funded / target * 100

    dom.donation_progress.style.width = `${Math.min(100, percentage.toFixed(0))}%`
    dom.donation_status.textContent = `${campaign.funded.currency_symbol}${funded.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${percentage.toFixed(0)}%)`
    dom.donation_goal.innerHTML = `of <b>${campaign.target.currency_symbol}${target.toLocaleString()}</b> raised`

    Promise.all(
        Array(pages)
            .fill()
            .map((x, i) => api.fetch_donations(campaign_id, i * donors_per_request))
    )
    .then(donor_pages => donor_pages.flat().slice(0, changes))
    .then(donations => donations.reverse().forEach(donation => {
        donation.date = relative_date_to_date(donation.date)
        donation.relative_date = () => time_since(donation.date)
        if(!first_load) add_to_trigger_queue(donation)
        else {
            const dom_donation = dom.add_donation(donation, skip_entries)
            dom_donation.addEventListener('click', () => add_to_trigger_queue(donation, true))
        }
    }))
}

function add_to_trigger_queue(entry, replay = false) {
    entry.replay = replay
    trigger_queue.push(entry)
    if(!triggering) trigger()
}

function skip() {
    dom.donation_alert.classList.toggle('pulse', false)
    dom.donation_alert.classList.toggle('hidden', true)
    setTimeout(() => {
        triggering = false
        trigger()
    }, 1000)
}

function update_manual_bar() {
    return api.fetch_google_info()
        .then(donations => {
            let amount = 0
            let target = 0
            donations.forEach(x => {
                console.log(amount)
                if(x.Amount) amount += x.Amount
                if(x.target) target += x.target
            })
            let percentage = amount / target * 100
            const campaign = {"funded":{'amount': amount,"currency_symbol":"S$"},"target":{"amount": target,"currency_symbol":"S$"}, percentage}
            console.log(campaign)
            dom.update_manual_donations(campaign)
        })
}

function trigger() {
    if(triggering || trigger_queue.length == 0) return
    triggering = true
    const donation = trigger_queue.shift()

    if(!donation.replay) {
        const dom_donation = dom.add_donation(donation)
        dom_donation.addEventListener('click', () => add_to_trigger_queue(donation, true))
    }

    if(audio_context.state == 'running') {
        donation_alert_sfx.volume = params.get('alert-volume') ?? 0.2
        donation_alert_sfx.pause()
        donation_alert_sfx.currentTime = 0
        donation_alert_sfx.play()
    }

    dom.show_alert(donation, skip, params.get('tts') ?? false, params.get('tts-voice') ?? 0, params.get('tts-volume') ?? 0.5)
}

function relative_date_to_date(relative_date) {
    let [value, unit] = relative_date.split(' ')
    if(unit.endsWith('s')) unit = unit.slice(0, -1)
    const time_interval = time_intervals.find(x => x.label === unit)?.seconds
    const timestamp = Date.now() - (value * time_interval * 1000)
    return new Date(timestamp)
}

function time_since(date) {
    const seconds = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000))
    const interval = time_intervals.find(i => i.seconds <= seconds)
    const count = Math.floor(seconds / interval.seconds)
    return `${count} ${interval.label}${count !== 1 ? 's' : ''} ago`
}

let updating = false
let triggering = false
let previous_total_donors
let campaign
let trigger_queue = []
let last_update

const time_intervals = [
    { label: 'year', seconds: 31536000 },
    { label: 'month', seconds: 2592000 },
    { label: 'week', seconds: 86400 * 7 },
    { label: 'day', seconds: 86400 },
    { label: 'hour', seconds: 3600 },
    { label: 'minute', seconds: 60 },
    { label: 'second', seconds: 1 }
]

const donation_alert_sfx = new Audio('./media/ka-ching.mp3')
let audio_context 

let init = false
document.body.classList.toggle('hidden', true)

window.addEventListener('click', () => {
    if(init) return
    document.body.classList.toggle('hidden', false)
    init = true
    audio_context = new AudioContext()
    const source = audio_context.createMediaElementSource(donation_alert_sfx)
    source.connect(audio_context.destination)
    audio_context.resume()
    window.speechSynthesis.resume()
    update()
    
    update_manual_bar().then(() => setTimeout(update_manual_bar, 1000))

})