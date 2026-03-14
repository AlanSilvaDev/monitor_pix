// Service Worker para Monitor Pix
// Versão do cache
const CACHE_NAME = 'monitor-pix-v1';

// Arquivos para fazer cache na instalação
const STATIC_ASSETS = [
    '/',
    '/static/manifest.json',
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap',
    'https://unpkg.com/lucide@latest'
];

// Evento de instalação
self.addEventListener('install', (event) => {
    console.log('🔧 Service Worker instalando...');
    
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('📦 Fazendo cache dos arquivos estáticos');
            return cache.addAll(STATIC_ASSETS).catch((err) => {
                console.log('⚠️  Alguns arquivos não puderam ser cacheados:', err);
                // Não falhar se alguns arquivos não forem encontrados
            });
        })
    );
    
    // Ativar o novo service worker imediatamente
    self.skipWaiting();
});

// Evento de ativação
self.addEventListener('activate', (event) => {
    console.log('✅ Service Worker ativado');
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('🗑️  Removendo cache antigo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    
    // Tomar controle de todas as abas abertas
    self.clients.claim();
});

// Evento de fetch - estratégia de cache com fallback
self.addEventListener('fetch', (event) => {
    // Ignorar requisições não-GET
    if (event.request.method !== 'GET') {
        return;
    }

    // Estratégia: Network first, fallback to cache
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Se a resposta for bem-sucedida, fazer cache dela
                if (response.status === 200) {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return response;
            })
            .catch(() => {
                // Se a requisição falhar, tentar usar o cache
                return caches.match(event.request).then((response) => {
                    if (response) {
                        return response;
                    }
                    
                    // Se não houver cache, retornar uma página offline
                    if (event.request.destination === 'document') {
                        return new Response(
                            `<!DOCTYPE html>
                            <html lang="pt-BR">
                            <head>
                                <meta charset="UTF-8">
                                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                <title>Monitor Pix - Offline</title>
                                <style>
                                    body {
                                        background: #0a0a0a;
                                        color: #f8fafc;
                                        font-family: 'Inter', Arial, sans-serif;
                                        display: flex;
                                        align-items: center;
                                        justify-content: center;
                                        min-height: 100vh;
                                        margin: 0;
                                        padding: 20px;
                                    }
                                    .container {
                                        text-align: center;
                                        max-width: 400px;
                                    }
                                    h1 {
                                        color: #00ff88;
                                        font-size: 32px;
                                        margin-bottom: 10px;
                                    }
                                    p {
                                        color: #cbd5e1;
                                        font-size: 16px;
                                        line-height: 1.6;
                                    }
                                    .icon {
                                        font-size: 64px;
                                        margin-bottom: 20px;
                                    }
                                </style>
                            </head>
                            <body>
                                <div class="container">
                                    <div class="icon">📡</div>
                                    <h1>Sem Conexão</h1>
                                    <p>Você está offline. Verifique sua conexão com a internet e tente novamente.</p>
                                    <p style="margin-top: 30px; font-size: 14px; color: #64748b;">
                                        Monitor Pix continuará funcionando quando a conexão for restaurada.
                                    </p>
                                </div>
                            </body>
                            </html>`,
                            {
                                headers: { 'Content-Type': 'text/html; charset=utf-8' }
                            }
                        );
                    }
                    
                    return null;
                });
            })
    );
});

// Sincronização em background (quando a conexão for restaurada)
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-pix-data') {
        console.log('🔄 Sincronizando dados do Pix...');
        event.waitUntil(
            fetch('/api/status')
                .then((response) => {
                    console.log('✅ Dados sincronizados com sucesso');
                    // Notificar o cliente
                    self.clients.matchAll().then((clients) => {
                        clients.forEach((client) => {
                            client.postMessage({
                                type: 'SYNC_COMPLETE',
                                data: 'Dados sincronizados'
                            });
                        });
                    });
                })
                .catch((error) => {
                    console.log('❌ Erro ao sincronizar:', error);
                })
        );
    }
});

// Push notifications (opcional, para notificações de novos Pix)
self.addEventListener('push', (event) => {
    if (event.data) {
        const options = {
            body: event.data.text(),
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect fill="%230a0a0a" width="192" height="192"/><circle cx="96" cy="96" r="80" fill="%2300ff88"/><text x="96" y="110" font-size="60" font-weight="bold" text-anchor="middle" fill="%230a0a0a" font-family="Arial">PIX</text></svg>',
            badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect fill="%230a0a0a" width="192" height="192"/><circle cx="96" cy="96" r="80" fill="%2300ff88"/><text x="96" y="110" font-size="60" font-weight="bold" text-anchor="middle" fill="%230a0a0a" font-family="Arial">PIX</text></svg>',
            tag: 'pix-notification',
            requireInteraction: true,
            actions: [
                {
                    action: 'open',
                    title: 'Abrir Dashboard'
                }
            ]
        };
        
        event.waitUntil(
            self.registration.showNotification('💰 Novo Pix Recebido!', options)
        );
    }
});

// Tratamento de cliques em notificações
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((clientList) => {
            // Procurar por uma aba já aberta
            for (let i = 0; i < clientList.length; i++) {
                const client = clientList[i];
                if (client.url === '/' && 'focus' in client) {
                    return client.focus();
                }
            }
            // Se não houver aba aberta, abrir uma nova
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});

console.log('✅ Service Worker carregado com sucesso');
