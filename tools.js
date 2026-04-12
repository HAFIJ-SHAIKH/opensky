(function() {

  function ft(url, ms) {
    return Promise.race([
      fetch(url),
      new Promise(function(_, rej) { setTimeout(function() { rej(new Error('Timeout')); }, ms || 6000); })
    ]);
  }

  var TOOLS = [
    { id:'wikipedia', name:'Wikipedia', icon:'\u{1F50D}',
      match:function(t){var m=t.match(/(?:wiki(?:pedia)?|tell me about|explain|what is|who is|who was|history of|look up|info on)\s+(.+)/i);return m?m[1].replace(/[?.!,]+$/,'').trim().replace(/^(the|a|an)\s+/i,''):null},
      exec:function(q){return ft('https://en.wikipedia.org/api/rest_v1/page/summary/'+encodeURIComponent(q)).then(function(r){return r.json()}).then(function(d){return(d.title?'**'+d.title+'**: ':'')+(d.extract||'Not found.')}).catch(function(){return 'Wikipedia unavailable.'})}},
    { id:'country', name:'Countries', icon:'\u{1F30D}',
      match:function(t){var m=t.match(/(?:population|capital|currency|language|gdp|area|region|info|details?|about)\s+(?:of|for|in)\s+(?:the\s+)?(?:country\s+)?(.+)/i);return m?m[1].replace(/[?.!,]+$/,'').trim():null},
      exec:function(q){return ft('https://restcountries.com/v3.1/name/'+encodeURIComponent(q)).then(function(r){return r.json()}).then(function(d){if(!d.length||d.message)return'Country not found.';var c=d[0];return'**'+(c.name?.common||q)+'** | Capital: '+(c.capital?.[0]||'N/A')+' | Pop: '+((c.population||0)/1e6).toFixed(1)+'M | Region: '+(c.region||'N/A')+' | Languages: '+Object.values(c.languages||{}).join(', ')+' | Currencies: '+Object.values(c.currencies||{}).map(function(x){return x.name}).join(', ')+' | Area: '+((c.area||0)/1e6).toFixed(1)+' km\u00B2'}).catch(function(){return 'Country data unavailable.'})}},
    { id:'weather', name:'Weather', icon:'\u{2600}',
      match:function(t){var m=t.match(/(?:weather|temperature|forecast|rain|snow|humid|wind|climate)\s+(?:in|at|for|of|today)\s+(.+)/i);return m?m[1].replace(/[?.!,]+$/,'').trim():null},
      exec:function(q){return ft('https://wttr.in/'+encodeURIComponent(q)+'?format=j1').then(function(r){return r.json()}).then(function(d){var c=d.current_condition?.[0];if(!c)return'Weather unavailable.';return'**'+(d.nearest_area?.[0]?.areaName?.[0]||q)+'**: '+c.temp_C+'\u00B0C (feels '+c.FeelsLikeC+'\u00B0C), '+c.weatherDesc?.[0]?.value+' | Humidity: '+c.humidity+'% | Wind: '+c.windspeedKmph+' km/h | UV: '+c.uvIndex}).catch(function(){return 'Weather unavailable.'})}},
    { id:'pokemon', name:'Pok\u00E9dex', icon:'\u{1F3FE}',
      match:function(t){var m=t.match(/(?:pokemon|pok[e\u00E9]dex)\s+(.+)/i);return m?m[1].replace(/[?.!,]+$/,'').trim():null},
      exec:function(q){return ft('https://pokeapi.co/api/v2/pokemon/'+encodeURIComponent(q.toLowerCase())).then(function(r){return r.json()}).then(function(d){return'**'+d.name+'** #'+d.id+' | Type: '+d.types.map(function(t){return t.type.name}).join('/')+' | Height: '+(d.height/10)+'m | Weight: '+(d.weight/10)+'kg | HP:'+d.stats[0].base_stat+' ATK:'+d.stats[1].base_stat+' DEF:'+d.stats[2].base_stat+' SPD:'+d.stats[5].base_stat+' | Abilities: '+d.abilities.map(function(a){return a.ability.name}).join(', ')}).catch(function(){return 'Pok\u00E9mon not found.'})}},
    { id:'advice', name:'Advice', icon:'\u{1F4A1}',
      match:function(t){return/(?:give me|need|want|have)?\s*(?:an?)?\s*advice/i.test(t)?'r':null},
      exec:function(){return ft('https://api.adviceslip.com/advice').then(function(r){return r.json()}).then(function(d){return d.slip?.advice||'Unavailable.'}).catch(function(){return 'Advice unavailable.'})}},
    { id:'dictionary', name:'Dictionary', icon:'\u{1F4D6}',
      match:function(t){var m=t.match(/(?:define|definition|meaning of|what does .+ mean)\s+(.+)/i);return m?m[1].replace(/[?.!,]+$/,'').trim():null},
      exec:function(q){return ft('https://api.dictionaryapi.dev/api/v2/entries/en/'+encodeURIComponent(q)).then(function(r){return r.json()}).then(function(d){if(d.title)return'Not found.';var e=d[0];return'**'+e.word+'** '+(e.phonetic||'')+'\n'+e.meanings.map(function(m){return m.partOfSpeech+': '+m.definitions.slice(0,2).map(function(d){return d.definition}).join('; ')}).join('\n')}).catch(function(){return 'Dictionary unavailable.'})}},
    { id:'joke', name:'Joke', icon:'\u{1F604}',
      match:function(t){return/(?:tell|say|give|have)\s*(?:me\s+)?a?\s*joke|make me laugh|something funny/i.test(t)?'r':null},
      exec:function(){return ft('https://official-joke-api.appspot.com/random_joke').then(function(r){return r.json()}).then(function(d){return d.setup+' ... '+d.punchline}).catch(function(){return 'Joke unavailable.'})}},
    { id:'number', name:'Number Fact', icon:'\u{1F522}',
      match:function(t){var m=t.match(/(?:fact|trivia)\s+(?:about\s+)?(?:the\s+)?number\s+(\d+)/i);return m?m[1]:null},
      exec:function(n){return ft('http://numbersapi.com/'+n+'?json').then(function(r){return r.json()}).then(function(d){return'**'+d.number+'**: '+d.text}).catch(function(){return 'Number fact unavailable.'})}},
    { id:'catfact', name:'Cat Fact', icon:'\u{1F431}',
      match:function(t){return/cat\s*fact|fact\s*(?:about|on)\s*cat/i.test(t)?'r':null},
      exec:function(){return ft('https://catfact.ninja/fact').then(function(r){return r.json()}).then(function(d){return d.fact}).catch(function(){return 'Cat fact unavailable.'})}},
    { id:'dog', name:'Dog', icon:'\u{1F436}',
      match:function(t){return/(?:show|get|random)\s*(?:me\s+)?(?:a\s+)?dog\s*(?:image|pic|photo)?/i.test(t)?'r':null},
      exec:function(){return ft('https://dog.ceo/api/breeds/image/random').then(function(r){return r.json()}).then(function(d){return'[Dog: '+d.message+']'}).catch(function(){return 'Dog unavailable.'})}},
    { id:'chuck', name:'Chuck Norris', icon:'\u{1F4AA}',
      match:function(t){return/chuck\s*norris/i.test(t)?'r':null},
      exec:function(){return ft('https://api.chucknorris.io/jokes/random').then(function(r){return r.json()}).then(function(d){return d.value}).catch(function(){return 'Unavailable.'})}},
    { id:'bored', name:'Activity', icon:'\u{1F3AE}',
      match:function(t){return/(?:bored|nothing to do|what should i do|suggest.*activity)/i.test(t)?'r':null},
      exec:function(){return ft('https://bored-api.appbrewery.com/random').then(function(r){return r.json()}).then(function(d){return'**'+d.activity+'** ('+d.type+', '+d.participants+' people)'}).catch(function(){return 'Activity unavailable.'})}},
    { id:'ip', name:'IP Location', icon:'\u{1F4CD}',
      match:function(t){return/(?:my\s+ip|ip\s*address|where\s*am\s*i|my\s*location|my\s*city)/i.test(t)?'r':null},
      exec:function(){return ft('https://ipapi.co/json/').then(function(r){return r.json()}).then(function(d){return'**IP:** '+d.ip+' | **City:** '+d.city+', '+d.region+' | **Country:** '+d.country_name+' ('+d.country_code+') | **ISP:** '+d.org+' | **TZ:** '+d.timezone}).catch(function(){return 'IP unavailable.'})}},
    { id:'crypto', name:'Crypto', icon:'\u{1F4B0}',
      match:function(t){var m=t.match(/(?:price|cost|value|worth)\s+(?:of\s+)?(?:the\s+)?(\w+)(?:\s+(?:crypto|coin|token))?/i);if(!m)m=t.match(/(?:bitcoin|btc|ethereum|eth|solana|sol|doge|dogecoin|xrp|cardano|ada|polygon|matic)\b/i);return m?(m[1]||m[0]).replace(/[?.!,]+$/,'').trim():null},
      exec:function(q){return ft('https://api.coingecko.com/api/v3/search?query='+encodeURIComponent(q)).then(function(r){return r.json()}).then(function(d){if(!d.coins?.length)return'Not found: '+q;var c=d.coins[0];return'**'+c.name+'** ('+c.symbol.toUpperCase()+') | Rank: #'+c.market_cap_rank}).catch(function(){return 'Crypto unavailable.'})}},
    { id:'exchange', name:'Exchange', icon:'\u{1F4B1}',
      match:function(t){var m=t.match(/(?:exchange\s*rate|convert|currency)\s+(.+)/i);return m?m[1].replace(/[?.!,]+$/,'').trim():null},
      exec:function(q){return ft('https://open.er-api.com/v6/latest/USD').then(function(r){return r.json()}).then(function(d){var rates=d.rates,words=q.toUpperCase().split(/\s+/),found=[];words.forEach(function(w){if(rates[w])found.push(w+': '+rates[w].toFixed(4))});return found.length?'**Rates per 1 USD:**\n'+found.join('\n'):'No matching currencies in "'+q+'".'}).catch(function(){return 'Exchange unavailable.'})}},
    { id:'trivia', name:'Trivia', icon:'\u{2753}',
      match:function(t){return/(?:trivia|quiz|test\s*me)/i.test(t)?'r':null},
      exec:function(){return ft('https://opentdb.com/api.php?amount=1&type=multiple').then(function(r){return r.json()}).then(function(d){if(!d.results?.length)return'Trivia unavailable.';var q=d.results[0],a=[q.correct_answer].concat(q.incorrect_answers).sort(function(){return Math.random()-.5});return'**'+q.category+'** ('+q.difficulty+')\n'+q.question+'\n'+a.map(function(x,i){return String.fromCharCode(65+i)+') '+x}).join('\n')+'\nAnswer: **'+q.correct_answer+'**'}).catch(function(){return 'Trivia unavailable.'})}},
    { id:'quote', name:'Quote', icon:'\u{1F4AC}',
      match:function(t){return/(?:quote|motivat|inspirat|wisdom|saying)/i.test(t)?'r':null},
      exec:function(){return ft('https://api.quotable.io/random').then(function(r){return r.json()}).then(function(d){return'**"'+d.content+'"** \u2014 '+d.author}).catch(function(){return ft('https://dummyjson.com/quotes/random').then(function(r){return r.json()}).then(function(d){return'**"'+d.quote+'"** \u2014 '+d.author}).catch(function(){return 'Quote unavailable.'})})}},
    { id:'github', name:'GitHub', icon:'\u{1F4BB}',
      match:function(t){var m=t.match(/(?:github|gh)\s+(?:user|profile|repo|stats?)\s+(?:of|for|about)?\s*@?(\w[\w-]*)/i);return m?m[1]:null},
      exec:function(q){return ft('https://api.github.com/users/'+encodeURIComponent(q)).then(function(r){return r.json()}).then(function(d){if(d.message)return'Not found: '+q;return'**'+d.login+'** | '+(d.name||'N/A')+' | Bio: '+(d.bio||'None')+' | Repos: '+d.public_repos+' | Followers: '+d.followers+' | Location: '+(d.location||'N/A')+' | '+d.html_url}).catch(function(){return 'GitHub unavailable.'})}},
    { id:'meal', name:'Recipe', icon:'\u{1F35A}',
      match:function(t){var m=t.match(/(?:recipe|meal|food|cook|dish)\s+(?:for|of|with)?\s*(.+)/i);return m?m[1].replace(/[?.!,]+$/,'').trim():null},
      exec:function(q){return ft('https://www.themealdb.com/api/json/v1/1/search.php?s='+encodeURIComponent(q)).then(function(r){return r.json()}).then(function(d){if(!d.meals?.length)return'No recipe for "'+q+'".';var m=d.meals[0],ings=[];for(var i=1;i<=20;i++){if(m['strIngredient'+i])ings.push('- '+m['strIngredient'+i]+' ('+(m['strMeasure'+i]||'')+')')}return'**'+m.strMeal+'** | '+m.strCategory+' | '+m.strArea+'\n\n**Ingredients:**\n'+ings.join('\n')+'\n\n**Instructions:**\n'+m.strInstructions}).catch(function(){return 'Recipe unavailable.'})}},
    { id:'university', name:'Universities', icon:'\u{1F393}',
      match:function(t){var m=t.match(/(?:universit(?:y|ies)|college)\s+(?:in|at|of)\s+(.+)/i);return m?m[1].replace(/[?.!,]+$/,'').trim():null},
      exec:function(q){return ft('http://universities.hipolabs.com/search?country='+encodeURIComponent(q)+'&limit=5').then(function(r){return r.json()}).then(function(d){if(!d.length)return'No universities for "'+q+'".';return d.map(function(u){return'- **'+u.name+'** | '+(u.country||'')+', '+(u['state-province']||'')+' | '+(u.web_pages?.[0]?'[Link]('+u.web_pages[0]+')':'No website')}).join('\n')}).catch(function(){return 'Universities unavailable.'})}},
    { id:'gender', name:'Gender Guess', icon:'\u{1F468}',
      match:function(t){var m=t.match(/(?:gender|is .+ (?:a|an|male|female|boy|girl))\s+(?:of|for|name)\s+(.+)/i);return m?m[1].replace(/[?.!,]+$/,'').trim():null},
      exec:function(q){return ft('https://api.genderize.io/?name='+encodeURIComponent(q)).then(function(r){return r.json()}).then(function(d){return'**'+d.name+'**: '+(d.gender||'unknown')+' ('+(d.probability?Math.round(d.probability*100)+'%':'N/A')+' confidence)'+(d.count?' | Based on '+d.count+' samples':'')}).catch(function(){return 'Gender unavailable.'})}},
    { id:'age', name:'Age Guess', icon:'\u{1F382}',
      match:function(t){var m=t.match(/(?:how old|age)\s+(?:is\s+|of\s+)?(?:the\s+)?(?:name\s+)?(.+)/i);return m?m[1].replace(/[?.!,]+$/,'').trim():null},
      exec:function(q){return ft('https://api.agify.io/?name='+encodeURIComponent(q)).then(function(r){return r.json()}).then(function(d){return'**'+d.name+'**: estimated age '+d.age+(d.count?' | Based on '+d.count+' samples':'')}).catch(function(){return 'Age unavailable.'})}}
  ];

  Agent.registerTools(TOOLS);

  Agent.execTools = function(matches) {
    return Promise.all(matches.map(function(m) {
      return m.tool.exec(m.query).then(function(data) {
        return { name: m.tool.name, icon: m.tool.icon, data: data, error: null };
      }).catch(function(e) {
        return { name: m.tool.name, icon: m.tool.icon, data: null, error: e.message || 'Failed' };
      });
    }));
  };

  Agent.toolCtx = function(results) {
    if (!results.length) return '';
    var c = '\n\n[TOOL RESULTS — incorporate specific data, cite tool name when relevant]:\n';
    results.forEach(function(r) { c += r.icon + ' ' + r.name + ': ' + (r.error ? 'Error — ' + r.error : r.data) + '\n'; });
    return c + '[END TOOL RESULTS]\n';
  };

  Agent.handleMemory = function(routeResult, text) {
    var ctx = '';
    if (routeResult.memStore) {
      var val = routeResult.memStore;
      Agent.memory.remember(val.split(/\s+/).slice(0, 4).join(' '), val, 'fact');
      ctx = '\n[SYSTEM: Memory stored: "' + val.slice(0, 80) + '". Acknowledge briefly if user explicitly asked.]\n';
    }
    if (routeResult.memForget) {
      Agent.memory.forget(routeResult.memForget);
      ctx = '\n[SYSTEM: Memory matching "' + routeResult.memForget + '" deleted. Confirm briefly.]\n';
    }
    if (routeResult.memRecall) {
      var results = Agent.memory.recall(text);
      if (results.length) {
        ctx = '\n[MEMORY RECALL]:\n';
        results.slice(0, 5).forEach(function(r) { ctx += '- [' + r.category.toUpperCase() + '] ' + r.key + ': ' + r.value + '\n'; });
        ctx += '[END RECALL]\n';
      } else {
        ctx = '\n[SYSTEM: No matching memories found. Say you don\'t recall anything about this.]\n';
      }
    }
    return ctx;
  };
})();
