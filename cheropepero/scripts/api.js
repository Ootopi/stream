function proxify(url) { return `https://corsproxy.io?${encodeURIComponent(url)}?random=${Math.random()}` }

function extract_currency(element) {
    const amount = Array.from(element.querySelector('.amount')?.childNodes).filter(x => x.nodeType === Node.TEXT_NODE).map(x => x.textContent).join('')
    const currency_symbol = element.querySelector('.woocommerce-Price-currencySymbol')?.textContent
    return { amount, currency_symbol }
}

function fetch_donations(campaign_id, offset = 0) {
    const url = proxify('https://rayofhope.sg/wp-admin/admin-ajax.php')
    const data = new FormData()
    data.append('action', 'momo_ajax_load_donorlist')
    data.append('id', campaign_id)
    data.append('offset', offset)

    return fetch(url, { method: 'POST', body: data, cache: 'no-cache' })
        .then(res => res.text())
        .then(text => {
            const parser = new DOMParser()
            const doc = parser.parseFromString(text, 'text/html')
            const donations = Array.from(doc.querySelectorAll('.donor-list-item'))
                .map(element => {
                    const donor = element.querySelector('.donation_amount strong')?.textContent
                    const { amount, currency_symbol } = extract_currency(element)
                    const date = element.querySelector('.donation_amount_date')?.textContent.trim()
                    const comment = element.querySelector('.donor-list-item-comment')?.textContent.trim()
                    return { donor, amount, currency_symbol, date, comment }
                })
            return donations
        })
}

function fetch_campaign_info(campaign_id) {
    const url = proxify(`https://rayofhope.sg/wp-json/wp/v2/product/${campaign_id}`)
    return fetch(url)
        .then(res => res.json())
        .then(metadata => 
            fetch(proxify(metadata.link), {cache: 'no-cache'})
                .then(res => res.text())
                .then(text => {
                    const parser = new DOMParser()
                    const doc = parser.parseFromString(text, 'text/html')
                    const campaign_summary = doc.querySelector('.wpneo-campaign-summary')
                    const funded = extract_currency(campaign_summary.querySelector('.funding-amount'))
                    const target = extract_currency(campaign_summary.querySelector('.raised-amount'))
                    const total_donors = parseInt(doc.querySelector('.donor-left').textContent.split(' ')[1].slice(1, -1))
                    const percentage = parseFloat(funded.amount.replace(',', '')) / parseFloat(target.amount.replace(',', '')) * 100
                    return { funded, target, total_donors, percentage }
                }
            )
        )
}

export default { fetch_campaign_info, fetch_donations }