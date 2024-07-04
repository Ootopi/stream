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

    const STORAGE_KEYS = {
        ACCESS_TOKEN: `${id}_access-token`,
        REFRESH_TOKEN: `${id}_refresh-token`,
        AUTH_CODE: `${id}_auth-code`,
        STATE: `${id}_state`,
        CODE_VERIFIER: `${id}_code-verifier`,
    }

    function request_refresh_token() {
        const refresh_token = config.storage.getItem(STORAGE_KEYS.REFRESH_TOKEN)
        const payload = {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token,
                client_id: config.client_id
            })
        }
        return fetch(config.token_endpoint, payload)
            .then(response => {
                if(response.status == 200) return response.json()
            })
            .then(json => {
                if(!json) return
                if(!json.access_token || !json.refresh_token) return
                config.storage.setItem(STORAGE_KEYS.ACCESS_TOKEN, json.access_token)
                config.storage.setItem(STORAGE_KEYS.REFRESH_TOKEN, json.refresh_token)
                return json.access_token
            })
        }

    function request_access_token() {
        const access_token = config.storage.getItem(STORAGE_KEYS.ACCESS_TOKEN)
        if(access_token) return Promise.resolve(access_token)
        const refresh_token = config.storage.getItem(STORAGE_KEYS.REFRESH_TOKEN)
        if(refresh_token) return request_refresh_token()
        const auth_code = request_auth_code()
        if(!auth_code) return
        const payload = {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: auth_code,
                redirect_uri: config.redirect_uri,
                client_id: config.client_id,
                code_verifier: config.storage.getItem(STORAGE_KEYS.CODE_VERIFIER)
            })
        }
        return fetch(config.token_endpoint, payload)
            .then(response => response.json())
            .then(json => {
                config.storage.setItem(STORAGE_KEYS.ACCESS_TOKEN, json.access_token)
                config.storage.setItem(STORAGE_KEYS.REFRESH_TOKEN, json.refresh_token)
                return access_token
            })
    }

    function request_auth_code() {
        let auth_code = config.storage.getItem(STORAGE_KEYS.AUTH_CODE)
        if(auth_code) return auth_code
        const search_params = new URLSearchParams(location.search)
        auth_code = search_params.get('code')
        const state = search_params.get('state')
        const valid_state = config.storage.getItem(STORAGE_KEYS.STATE)
        if(auth_code && state == valid_state) {
            config.storage.setItem(STORAGE_KEYS.AUTH_CODE, auth_code)
            config.storage.removeItem(STORAGE_KEYS.STATE)
            return location.replace(`${location.origin}${location.pathname}`)
        }
        request_user_auth()
    }

    async function request_user_auth(params) {
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
        location.replace(url)
    }

    function invalidate_access_token() {
        config.storage.removeItem(STORAGE_KEYS.ACCESS_TOKEN)
    }

    return { request_access_token, invalidate_access_token }
}