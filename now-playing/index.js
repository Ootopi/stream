const search_params = new URLSearchParams(location.search)
const reset = search_params.get('reset')
if(reset) localStorage.clear()