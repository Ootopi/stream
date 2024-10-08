function random_values(length) { return crypto.getRandomValues(new Uint8Array(length)) }
function random_chars(length, allowed_chars) { return  Array.from(random_values(length)).map(x => allowed_chars[x % allowed_chars.length] ) }
function random_string(length, allowed_chars) { return random_chars(length, allowed_chars).join('') }

function clamp(num, min, max) { return Math.max(min, Math.min(max, num)) }

function sha256(plain) { return crypto.subtle.digest('SHA-256', new TextEncoder().encode(plain)) }
function base64_url_encode(input) { return btoa(String.fromCharCode(...new Uint8Array(input))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_') }

const ALPHA_UPPER = Array(26).fill().map((x, i) => String.fromCharCode('A'.charCodeAt(0) + i))
const ALPHA_LOWER = Array(26).fill().map((x, i) => String.fromCharCode('a'.charCodeAt(0) + i))
const ALPHA = [...ALPHA_UPPER, ...ALPHA_LOWER]
const NUMERIC = Array(10).fill().map((x, i) => String.fromCharCode('0'.charCodeAt(0) + i))
const ALPHANUMERIC = [...ALPHA, ...NUMERIC]

const CODE_VERIFIER_CHARS = [...ALPHANUMERIC, ...'-._~']

function create_code_verifier(length = 128) { return random_string(clamp(length, 43, 128), CODE_VERIFIER_CHARS) }
function derive_code_challenge(code_verifier) { return sha256(code_verifier).then(base64_url_encode) }

export default function(id, config) {
    config = { storage: localStorage, ...config }

    let access_token
    let auth_code
    let requesting_user_auth = false

    const STORAGE_KEYS = {
        ACCESS_TOKEN: `${id}_access-token`, // To phase out
        REFRESH_TOKEN: `${id}_refresh-token`,
        AUTH_CODE: `${id}_auth-code`, // To phase out
        STATE: `${id}_state`,
        CODE_VERIFIER: `${id}_code-verifier`,
    }

    function update_tokens(json) {
        return new Promise((resolve, reject) => {
            if(!json.access_token || !json.refresh_token) return reject()
            access_token = json.access_token
            config.storage.removeItem(STORAGE_KEYS.STATE)
            config.storage.removeItem(STORAGE_KEYS.CODE_VERIFIER)
            config.storage.setItem(STORAGE_KEYS.REFRESH_TOKEN, json.refresh_token)
            return resolve({access_token, refresh_token: json.refresh_token})
        })
    }

    function get_refresh_token() { 
        return new Promise((resolve, reject) => {
            const token = config.storage.getItem(STORAGE_KEYS.REFRESH_TOKEN)
            return token ? resolve(token) : reject()
        })
    }

    function fetch_tokens(body_params) {
        const payload = {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: config.client_id,
                ...body_params
            })
        }
        return fetch(config.token_endpoint, payload)
            .then(response => response.status == 200 ? response.json() : Promise.reject('Token request unsuccessful.'))
            .then(update_tokens)
    }

    function request_tokens_refresh() {
        return get_refresh_token()
            .then(refresh_token => fetch_tokens({ grant_type: 'refresh_token', refresh_token }))
    }

    function request_tokens(params) {
        return extract_auth_code_from_url()
            .then(auth_code => fetch_tokens({
                grant_type: 'authorization_code',
                code: auth_code,
                redirect_uri: config.redirect_uri,
                client_id: config.client_id,
                code_verifier: config.storage.getItem(STORAGE_KEYS.CODE_VERIFIER)
            }).then(remove_search_params), () => request_user_auth(params))
    }

    function extract_access_token_from_url() {
        return new Promise((resolve, reject) => {
            const search_params = new URLSearchParams(location.hash.substring(1))
            access_token = search_params.get('access_token')
            const provided_state = search_params.get('state')
            const state = config.storage.getItem(STORAGE_KEYS.STATE)
            if(!provided_state || !state) return reject()
            if(!access_token || provided_state !== state) return reject()
            config.storage.removeItem(STORAGE_KEYS.STATE)
            return resolve(access_token)
        })
    }

    function extract_auth_code_from_url() {
        return new Promise((resolve, reject) => {
            const search_params = new URLSearchParams(location.search)
            auth_code = search_params.get('code')
            const provided_state = search_params.get('state')
            const state = config.storage.getItem(STORAGE_KEYS.STATE)
            if(!provided_state || !state) return reject()
            if(!auth_code || provided_state !== state) return reject()
            config.storage.removeItem(STORAGE_KEYS.STATE)
            return resolve(auth_code)
        })
    }

    function remove_search_params() { location.replace(`${location.origin}${location.pathname}`) }

    async function request_access_token(params) {
        if(!access_token) await request_tokens_refresh()
            .catch(extract_access_token_from_url)
            .catch(() => request_tokens(params))
        return new Promise((resolve, reject) => access_token ? resolve(access_token) : reject())
    }

    async function user_auth_url(params) {
        const code_verifier = create_code_verifier()
        config.storage.setItem(STORAGE_KEYS.CODE_VERIFIER, code_verifier)
        const code_challenge = await derive_code_challenge(code_verifier)
        const state = random_string(32, ALPHANUMERIC)
        config.storage.setItem(STORAGE_KEYS.STATE, state)
        const search_params = new URLSearchParams({
            response_type: 'code',
            client_id: config.client_id,
            redirect_uri: config.redirect_uri,
            scope: config.requested_scopes,
            state,
            code_challenge,
            code_challenge_method: 'S256',
            ...params
        })
        const url = new URL(config.authorization_endpoint)
        url.search = search_params.toString()
        return url
    }

    async function request_user_auth(params) {
        if(requesting_user_auth) return
        request_user_auth = true
        location.replace(await user_auth_url(params))
    }

    function invalidate_access_token() {
        access_token = undefined
        config.storage.removeItem(STORAGE_KEYS.ACCESS_TOKEN)
        config.storage.removeItem(STORAGE_KEYS.AUTH_CODE)
    }

    return { request_access_token, invalidate_access_token }
}

