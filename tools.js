(function() {
  var T = [
    { id:'wiki', name:'Wikipedia', icon:'\u{1F50D}', match:function(t){var m=t.match(/(?:wiki(?:pedia)?|tell me about|explain|what is|who is|who was|history of|look up|info on)\s+(.+)/i);return m?m[1].replace(/[?.!,]+$/,'').trim().replace(/^(the|a|an)\s+/i,''):null},
      exec:function(q){return fetch('https://en.wikipedia.org/api/rest_v1/page/summary/'+encodeURIComponent(q)).then(function(r){return r.json()}).then(function(d){return(d.title?'**'+d.title+'**: ':'')+(d.extract||'No summary found.')}).catch(function(){return'Could not fetch Wikipedia.'})}},
    { id:'country', name:'Countries', icon:'\u{1F30D}', match:function(t){var m=t.match(/(?:population|capital|currency|language|gdp|area|region|info|details?|about)\s+(?:of|for|in)\s+(?:the\s+)?(?:country\s+)?(.+)/i);return m?m[1].replace(/[?.!,]+$/,'').trim():null},
      exec:function(q){return fetch('https://restcountries.com/v3.1/name/'+encodeURIComponent(q)).then(function(r){return r.json()}).then(function(d){if(!d.length||d.message)return'Country not found.';var c=d[0];return'**'+(c.name?.common||q)+'** | Capital: '+(c.capital?.[0]||'N/A')+' | Pop: '+((c.population||0)/1e6).toFixed(1)+'M | Region: '+(c.region||'N/A')+' | Languages: '+Object.values(c.languages||{}).join(', ')+' | Currencies: '+Object.values(c.currencies||{}).map(function(x){return x.name}).join(', ')+' | Area: '+((c.area||0)/1e6).toFixed(1)+' km\u00B2'}).catch(function(){return'Could not fetch country.'})}},
    { id:'weather', name:'Weather', icon:'\u{2600}\u{FE0F}', match:function(t){var m=t.match(/(?:weather|temperature|forecast|rain|snow|humid|wind|climate)\s+(?:in|at|for|of)\s+(.+)/i);return m?m[1].replace(/[?.!,]+$/,'').trim():null},
      exec:function(q){return fetch('https://wttr.in/'+encodeURIComponent(q)+'?format=j1').then(function(r){return r.json()}).then(function(d){var c=d.current_condition?.[0];if(!c)return'Weather unavailable.';return'**'+q+'**: '+c.temp_C+'\u00B0C (feels '+c.FeelsLikeC+'\u00B0C), '+c.weatherDesc?.[0]?.value+' | Humidity: '+c.humidity+'% | Wind: '+c.windspeedKmph+' km/h | Visibility: '+c.visibility+' km'}).catch(function(){return'Could not fetch weather.'})}},
    { id:'pokemon', name:'Pok\u00E9dex', icon:'\u{1F3FE}', match:function(t){var m=t.match(/(?:pokemon|pok[e\u00E9]dex)\s+(.+)/i);return m?m[1].replace(/[?.!,]+$/,'').trim():null},
      exec:function(q){return fetch('https://pokeapi.co/api/v2/pokemon/'+encodeURIComponent(q.toLowerCase())).then(function(r){return r.json()}).then(function(d){return'**'+d.name+'** #'+d.id+' | Type: '+d.types.map(function(t){return t.type.name}).join('/')+' | '+d.height/10+'m | '+d.weight/10+'kg | HP:'+d.stats[0].base_stat+' ATK:'+d.stats[1].base_stat+' DEF:'+d.stats[2].base_stat+' SPD:'+d.stats[5].base_stat}).catch(function(){return'Not found.'})}},
    { id:'advice', name:'Advice', icon:'\u{1F4A1}', match:function(t){return/(?:give me|need|want|have)?\s*(?:an?)?\s*advice/i.test(t)?'r':null},
      exec:function(){return fetch('https://api.adviceslip.com/advice').then(function(r){return r.json()}).then(function(d){return d.slip?.advice||'N/A'}).catch(function(){return'Could not fetch.'})}},
    { id:'dict', name:'Dictionary', icon:'\u{1F4D6}', match:function(t){var m=t.match(/(?:define|definition|meaning of|what does .+ mean)\s+(.+)/i);return m?m[1].replace(/[?.!,]+$/,'').trim():null},
      exec:function(q){return fetch('https://api.dictionaryapi.dev/api/v2/entries/en/'+encodeURIComponent(q)).then(function(r){return r.json()}).then(function(d){if(d.title)return'Not found.';var e=d[0];return'**'+e.word+'** '+(e.phonetic||'')+'\n'+e.meanings.map(function(m){return m.partOfSpeech+': '+m.definitions.slice(0,2).map(function(d){return d.definition}).join('; ')}).join('\n')}).catch(function(){return'Could not fetch.'})}},
    { id:'joke', name:'Joke', icon:'\u{1F604}', match:function(t){return/(?:tell|say|give|have)\s*(?:me\s+)?a?\s*joke|make me laugh|something funny/i.test(t)?'r':null},
      exec:function(){return fetch('https://official-joke-api.appspot.com/random_joke').then(function(r){return r.json()}).then(function(d){return d.setup+' ... '+d.punchline}).catch(function(){return'Could not fetch.'})}},
    { id:'num', name:'Number', icon:'\u{1F522}', match:function(t){var m=t.match(/(?:fact|trivia)\s+(?:about\s+)?(?:the\s+)?number\s+(\d+)/i);return m?m[1]:null},
      exec:function(n){return fetch('http://numbersapi.com/'+n+'?json').then(function(r){return r.json()}).then(function(d){return'**'+d.number+'**: '+d.text}).catch(function(){return'Could not fetch.'})}},
    { id:'cat', name:'Cat Fact', icon:'\u{1F431}', match:function(t){return/cat\s*fact|fact\s*(?:about|on)\s*cat/i.test(t)?'r':null},
      exec:function(){return fetch('https://catfact.ninja/fact').then(function(r){return r.json()}).then(function(d){return d.fact}).catch(function(){return'Could not fetch.'})}},
    { id:'dog', name:'Dog Image', icon:'\u{1F436}', match:function(t){return/(?:show|get|random)\s*(?:me\s+)?(?:a\s+)?dog\s*(?:image|pic|photo)?/i.test(t)?'r':null},
      exec:function(){return fetch('https://dog.ceo/api/breeds/image/random').then(function(r){return r.json()}).then(function(d){return'[Dog photo: '+d.message+']'}).catch(function(){return'Could not fetch.'})}},
    { id:'chuck', name:'Chuck Norris', icon:'\u{1F4AA}', match:function(t){return/chuck\s*norris/i.test(t)?'r':null},
      exec:function(){return fetch('https://api.chucknorris.io/jokes/random').then(function(r){return r.json()}).then(function(d){return d.value}).catch(function(){return'Could not fetch.'})}},
    { id:'bored', name:'Activity', icon:'\u{1F3AE}', match:function(t){return/(?:bored|nothing to do|what should i do|suggest.*activity)/i.test(t)?'r':null},
      exec:function(){return fetch('https://bored-api.appbrewery.com/random').then(function(r){return r.json()}).then(function(d){return'**'+d.activity+'** ('+d.type+', '+d.participants+' person'+(d.participants>1?'s':'')+')'}).catch(function(){return'Could not fetch.'})}},
    { id:'ip', name:'IP Location', icon:'\u{1F4CD}', match:function(t){return/(?:my\s+ip|ip\s*address|where\s*am\s*i|my\s*location|my\s*city)/i.test(t)?'r':null},
      exec:function(){return fetch('https://ipapi.co/json/').then(function(r){return r.json()}).then(function(d){return'**IP:** '+d.ip+' | **City:** '+d.city+', '+d.region+' | **Country:** '+d.country_name+' ('+d.country_code+') | **ISP:** '+d.org+' | **TZ:** '+d.timezone}).catch(function(){return'Could not fetch.'})}},
    { id:'crypto', name:'Crypto', icon:'\u{1F4B0}', match:function(t){var m=t.match(/(?:price|cost|value|worth|rate)\s+(?:of\s+)?(?:the\s+)?(\w+)/i);if(!m)m=t.match(/(?:bitcoin|btc|ethereum|eth|solana|sol|doge|xrp|cardano|ada|polygon|matic|polkadot|dot|avalanche|avax|chainlink|link|uni|uniswap|shib|shiba|tron|trx|ton)\b/i);return m?(m[1]||m[0]).replace(/[?.!,]+$/,'').trim():null},
      exec:function(q){return fetch('https://api.coingecko.com/api/v3/search?query='+encodeURIComponent(q)).then(function(r){return r.json()}).then(function(d){if(!d.coins?.length)return'Not found: '+q;var c=d.coins[0];return'**'+c.name+'** ('+c.symbol.toUpperCase()+') | Rank: #'+c.market_cap_rank+(c.price_btc?' | '+c.price_btc.toFixed(8)+' BTC':'')}).catch(function(){return'Could not fetch.'})}},
    { id:'exchange', name:'Exchange', icon:'\u{1F4B1}', match:function(t){var m=t.match(/(?:exchange\s*rate|convert|currency)\s+(.+)/i);return m?m[1].replace(/[?.!,]+$/,'').trim():null},
      exec:function(q){return fetch('https://open.er-api.com/v6/latest/USD').then(function(r){return r.json()}).then(function(d){var r=d.rates,w=q.toUpperCase().split(/\s+/),f=[];w.forEach(function(c){if(r[c])f.push(c+': '+r[c].toFixed(4)+' USD')});return f.length?'**Rates (per USD):**\n'+f.join('\n'):'No matching currencies found.'}).catch(function(){return'Could not fetch.'})}},
    { id:'trivia', name:'Trivia', icon:'\u{2753}', match:function(t){return/(?:trivia|quiz\s*question|test\s*me)/i.test(t)?'r':null},
      exec:function(){return fetch('https://opentdb.com/api.php?amount=1&type=multiple').then(function(r){return r.json()}).then(function(d){if(!d.results?.length)return'Could not fetch.';var q=d.results[0],a=[q.correct_answer].concat(q.incorrect_answers).sort(function(){return Math.random()-.5});return'**'+q.category+'** ('+q.difficulty+')\n\n'+q.question+'\n\n'+a.map(function(x,i){return String.fromCharCode(65+i)+') '+x}).join('\n')+'\n\nAnswer: **'+q.correct_answer+'**'}).catch(function(){return'Could not fetch.'})}},
    { id:'quote', name:'Quote', icon:'\u{1F4AC}', match:function(t){return/(?:quote|motivat|inspirat|wisdom|saying)/i.test(t)?'r':null},
      exec:function(){return fetch('https://api.quotable.io/random').then(function(r){return r.json()}).then(function(d){return'**"'+d.content+'"**\n\u2014 '+d.author}).catch(function(){return fetch('https://dummyjson.com/quotes/random').then(function(r){return r.json()}).then(function(d){return'**"'+d.quote+'"**\n\u2014 '+d.author}).catch(function(){return'Could not fetch.'})})}},
    { id:'github', name:'GitHub', icon:'\u{1F4BB}', match:function(t){var m=t.match(/(?:github|gh)\s+(?:user|profile|repo|stats?)\s+(?:of|for|about)?\s*@?(\w[\w-]*)/i);return m?m[1]:null},
      exec:function(q){return fetch('https://api.github.com/users/'+encodeURIComponent(q)).then(function(r){return r.json()}).then(function(d){if(d.message)return'Not found: '+q;return'**'+d.login+'** | '+(d.name||'N/A')+' | Bio: '+(d.bio||'No bio')+' | Repos: '+d.public_repos+' | Followers: '+d.followers+' | Location: '+(d.location||'N/A')}).catch(function(){return'Could not fetch.'})}},
    { id:'meal', name:'Recipe', icon:'\u{1F35A}', match:function(t){var m=t.match(/(?:recipe|meal|food|cook|dish)\s+(?:for|of|with)?\s*(.+)/i);return m?m[1].replace(/[?.!,]+$/,'').trim():null},
      exec:function(q){return fetch('https://www.themealdb.com/api/json/v1/1/search.php?s='+encodeURIComponent(q)).then(function(r){return r.json()}).then(function(d){if(!d.meals?.length)return'No recipe found.';var m=d.meals[0],ings=[];for(var i=1;i<=20;i++)if(m['strIngredient'+i])ings.push('- '+m['strIngredient'+i]+' ('+(m['strMeasure'+i]||'')+')');return'**'+m.strMeal+'** | '+m.strCategory+' | '+m.strArea+'\n\n**Ingredients:**\n'+ings.join('\n')+'\n\n**Instructions:**\n'+m.strInstructions}).catch(function(){return'Could not fetch.'})}},
    { id:'uni', name:'Universities', icon:'\u{1F393}', match:function(t){var m=t.match(/(?:universit(?:y|ies)|college)\s+(?:in|at|of)\s+(.+)/i);return m?m[1].replace(/[?.!,]+$/,'').trim():null},
      exec:function(q){return fetch('http://universities.hipolabs.com/search?country='+encodeURIComponent(q)+'&limit=5').then(function(r){return r.json()}).then(function(d){if(!d.length)return'No universities found.';return d.map(function(u){return'- **'+u.name+'** | '+(u.country||'')+', '+(u['state-province']||'')+(u.web_pages?.[0]?' | [Site]('+u.web_pages[0]+')':'')}).join('\n')}).catch(function(){return'Could not fetch.'})}},
    /* Internal tools (no API calls) */
    { id:'math', name:'Calculate', icon:'\u{1F4CA}', match:function(t){var m=t.match(/(?:calculate|compute|solve|eval|what(?:'s| is))\s+(.+?)(?:\s*[=？]\s*(.+))?$/i);return m?{expr:m[1].trim(),extra:m[2]||null}:null},
      exec:function(q){try{var expr=(typeof q==='string'?q:q.expr).replace(/[^0-9+\-*/().%\s]/g,'');var safe=expr.replace(/\^/g,'**');var result=Function('"use strict";return ('+safe+')')();if(typeof result==='number'&&!isFinite(result))return'Error: result is infinite';return'**'+expr.trim()+'** = '+result}catch(e){return'Could not calculate: '+e.message}}},
    { id:'password', name:'Password', icon:'\u{1F511}', match:function(t){return/(?:generate|create|make|random)\s*(?:a\s+)?(?:strong\s+)?(?:password|passphrase|secret)/i.test(t)?'r':null},
      exec:function(){var chars='abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*';var len=16,pw='';for(var i=0;i<len;i++)pw+=chars.charAt(Math.floor(Math.random()*chars.length));return'**Generated password:** `'+pw+'`\n\nLength: '+len+' characters. Mix of uppercase, lowercase, numbers, and symbols.'}},
    { id:'date', name:'Date/Time', icon:'\u{1F4C5}', match:function(t){var m=t.match(/(?:current|what(?:'s| is) the)?\s*(?:date|time|day|month|year|weekday)/i);return m?new Date().toISOString():null},
      exec:function(d){try{var dt=new Date(d);if(isNaN(dt.getTime()))dt=new Date();var opts={weekday:'long',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',timeZoneName:'short'};return'**'+dt.toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})+'**\n**'+dt.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit'})+'**\n**'+dt.toLocaleDateString('en-US',{timeZoneName:'short'})+'**\nUnix timestamp: '+Math.floor(dt.getTime()/1000)}catch(e){return'Could not parse date.'}}},
    { id:'lorem', name:'Lorem Ipsum', icon:'\u{1F4DD}', match:function(t){return/(?:lorem\s*ipsum|placeholder\s*text|dummy\s*text|filler\s*text)/i.test(t)?'r':null},
      exec:function(){return'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.\n\nSed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit.'}},
    { id:'uuid', name:'UUID', icon:'\u{1F195}', match:function(t){return/(?:generate|create|get|new)\s*(?:a\s+)?(?:uuid|guid|unique\s*id)/i.test(t)?'r':null},
      exec:function(){return'**'+crypto.randomUUID()+'**'}}
  ];

  Agent.registerTools(T);

  function execTools(matches) {
    return Promise.all(matches.map(function(m) {
      return m.tool.exec(m.query)
        .then(function(data) { return { name: m.tool.name, icon: m.tool.icon, data: data, error: null }; })
        .catch(function(e) { return { name: m.tool.name, icon: m.tool.icon, data: null, error: e.message }; });
    }));
  }

  function fmtCtx(results) {
    if (!results.length) return '';
    var c = '\n\n[TOOL RESULTS — incorporate specific data into your response]:\n';
    results.forEach(function(r) { c += r.icon + ' ' + r.name + ': ' + (r.error ? 'Error — ' + r.error : r.data) + '\n'; });
    return c + '[END TOOL RESULTS]\n';
  }

  function handleMem(rr, text) {
    var ctx = '';
    if (rr.memStore) { var w = rr.memStore.split(/\s+/).slice(0, 4).join(' '); Agent.memory.remember(w, rr.memStore, 'fact'); ctx = '\n[SYSTEM: Stored memory: "' + rr.memStore.slice(0, 80) + '". Acknowledge briefly if user asked.]\n'; }
    if (rr.memForget) { Agent.memory.forget(rr.memForget); ctx += '\n[SYSTEM: Forgot memory matching "' + rr.memForget + '". Confirm.]\n'; }
    if (rr.memRecall) { var res = Agent.memory.recall(text); if (res.length) { ctx = '\n[MEMORY RECALL]:\n'; res.slice(0, 5).forEach(function(r) { ctx += '- [' + r.cat.toUpperCase() + '] ' + r.key + ': ' + r.value + '\n'; }); ctx += '[END RECALL]\n'; } else ctx = '\n[MEMORY: No matching memories found.]\n'; }
    return ctx;
  }

  Agent.execTools = execTools;
  Agent.toolCtx = fmtCtx;
  Agent.handleMem = handleMem;
})();
