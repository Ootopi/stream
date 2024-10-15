import dom from './dom.js'

const overlay = dom.div()
overlay.classList.toggle('overlay')
document.body.appendChild(overlay)

const donation_bar_manual = dom.div()
donation_bar_manual.classList.toggle('donation-bar')
donation_bar_manual.id = 'donation-bar'
overlay.append(donation_bar_manual)

const donation_progress_manual = dom.div()
donation_progress_manual.classList.toggle('progress')
donation_bar_manual.append(donation_progress_manual)

const donation_status_manual = dom.div()
donation_status_manual.classList.toggle('status')
donation_bar_manual.append(donation_status_manual)

const donation_goal_manual = dom.div()
donation_goal_manual.classList.toggle('goal')
donation_bar_manual.append(donation_goal_manual)

const donation_bar = dom.div()
donation_bar.classList.toggle('donation-bar')
donation_bar.id = 'donation-bar'
overlay.append(donation_bar)

const donation_progress = dom.div()
donation_progress.classList.toggle('progress')
donation_bar.append(donation_progress)

const donation_status = dom.div()
donation_status.classList.toggle('status')
donation_bar.append(donation_status)

const donation_goal = dom.div()
donation_goal.classList.toggle('goal')
donation_bar.append(donation_goal)

const donation_list = dom.div()
donation_list.classList.toggle('donation-list')
overlay.appendChild(donation_list)

const donation_alert_wrapper = dom.div()
donation_alert_wrapper.classList.toggle('donation-alert-wrapper')
overlay.appendChild(donation_alert_wrapper)

let donation_alert = dom.div()
donation_alert.classList.toggle('donation-alert')
donation_alert_wrapper.appendChild(donation_alert)

const donation_alert_image = dom.div()
donation_alert_image.classList.toggle('image')
donation_alert.appendChild(donation_alert_image)

const donation_alert_name = dom.div()
donation_alert_name.classList.toggle('name')
donation_alert.appendChild(donation_alert_name)

const donation_alert_amount_prefix = dom.div()
donation_alert_amount_prefix.classList.toggle('amount-prefix')
donation_alert.appendChild(donation_alert_amount_prefix)

const donation_alert_amount = dom.div()
donation_alert_amount.classList.toggle('amount')
donation_alert.appendChild(donation_alert_amount)

const donation_alert_message = dom.div()
donation_alert_message.classList.toggle('message')
donation_alert.appendChild(donation_alert_message)

function show_alert(donation, on_alert_end, tts_enabled, tts_voice, tts_volume) {

    const possible_images = [ 'clap', 'uwu', 'blankies', 'thankegg'] // 'panda', 'gasp', 'jam', 'bunny', 'hearts',
    const random_image = Math.floor(Math.random() * possible_images.length)
    possible_images.forEach((x, i) => donation_alert_image.classList.toggle(x, i == random_image))

    donation_alert_name.textContent = donation.donor
    donation_alert_amount_prefix.textContent = ' has donated '
    const amount = parseFloat(donation.amount.replace(',', ''))
    const has_decimal = Math.round(amount) != amount
    donation_alert_amount.textContent = ` ${donation.currency_symbol}${has_decimal ? amount.toFixed(2) : amount}`
    donation_alert_message.textContent = donation.comment
    
    if(donation.comment.length > 0 && tts_enabled) {
        const msg = new SpeechSynthesisUtterance()
        msg.voice = window.speechSynthesis.getVoices()[tts_voice ?? 0]
        msg.volume = tts_volume
        msg.text = donation.comment
        window.speechSynthesis.speak(msg)
    }
  
    donation_alert.classList.toggle('pulse', false)
    donation_alert.classList.toggle('pulse', true)
    donation_alert.classList.toggle('hidden', false)

    donation_alert.onanimationend = on_alert_end
}

function add_donation(donation, skip_entries) {
    const { donor, amount, currency_symbol, date, relative_date, comment } = donation
    const dom = document.createElement('div')
    dom.classList.toggle('donation')
    donation_list.insertBefore(dom, donation_list.firstChild)
    dom.classList.toggle('skipped', donation_list.children.length <= skip_entries)

    const dom_donor_name = document.createElement('span')
    dom_donor_name.classList.toggle('donor-name')
    dom.appendChild(dom_donor_name)
    dom_donor_name.textContent = donor

    const dom_amount = document.createElement('span')
    dom_amount.classList.toggle('donation-amount')
    dom.appendChild(dom_amount)
    const parsed_amount = parseFloat(amount)
    const has_decimal = Math.round(parsed_amount) != parsed_amount
    dom_amount.textContent = `${currency_symbol} ${has_decimal ? parsed_amount.toFixed(2) : parsed_amount}`

    const dom_time_since = document.createElement('span')
    dom_time_since.classList.toggle('donation-time-since')
    dom.appendChild(dom_time_since)
    dom_time_since.textContent = relative_date()

    dom._entry = donation

    donation_list.scrollTop = 0

    donations.push({ dom, donation })

    return dom
}

const donations = []

function update_donations() {
    donations.forEach(({dom, donation}) => {
       const dom_time_since = dom.querySelector('.donation-time-since')
       dom_time_since.textContent = donation.relative_date()
    })
}

function update_manual_donations(campaign) {
    console.log(campaign)
    donation_progress_manual.style.width = `${Math.min(100, campaign.percentage.toFixed(0))}%`
    donation_status_manual.textContent = `${campaign.funded.currency_symbol}${campaign.funded.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${campaign.percentage.toFixed(0)}%)`
    donation_goal_manual.innerHTML = `of <b>${campaign.target.currency_symbol}${campaign.target.amount.toLocaleString()}</b> raised`
}

export default { donation_progress, donation_status, donation_goal, donation_alert, update_donations, add_donation, show_alert, update_manual_donations }