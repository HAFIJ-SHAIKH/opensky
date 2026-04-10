export async function onRequestGet(context) {
    const { env } = context;

    if (!env.key) {
        return new Response(JSON.stringify({ valid: false }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const res = await fetch('https://openrouter.ai/api/v1/models', {
            headers: {
                'Authorization': `Bearer ${env.key}`
            }
        });

        const valid = res.status !== 401 && res.status !== 403;

        return new Response(JSON.stringify({ valid }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err) {
        return new Response(JSON.stringify({ valid: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
