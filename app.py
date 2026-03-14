from flask import Flask, render_template
import requests
import time
import threading
import logging
from datetime import datetime


# Configurando logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


app = Flask(__name__)


# Token de acesso do Mercado Pago
ACCESS_TOKEN = "SEU_ACCESS_TOKEN_AQUI"

# Variáveis globais para armazenar o estado
ultimo_pagamento = None
status_pagamento = "Aguardando pagamento..."
valor_pagamento = ""
historico_pix = []
total_dia = 0


def monitor_pix():
    """
    Monitora continuamente a API do Mercado Pago para novos pagamentos via Pix.
    Atualiza o status, o histórico e o total acumulado do dia.
    """
    global ultimo_pagamento, status_pagamento, valor_pagamento, historico_pix, total_dia

    url = "https://api.mercadopago.com/v1/payments/search"
    headers = {
        "Authorization": f"Bearer {ACCESS_TOKEN}"
    }

    logger.info("🚀 Monitor Pix iniciado com sucesso!")

    while True:
        try:
            params = {
                "sort": "date_created",
                "criteria": "desc",
                "limit": 1
            }

            # Fazendo requisição à API do Mercado Pago
            response = requests.get(url, headers=headers, params=params, timeout=10)
            response.raise_for_status()

            data = response.json()

            # Verificaando se há resultados
            if "results" in data and len(data["results"]) > 0:
                pagamento = data["results"][0]

                id_pagamento = pagamento.get("id")
                status = pagamento.get("status")
                valor = pagamento.get("transaction_amount")

                # Verificar se é um novo pagamento aprovado
                if id_pagamento != ultimo_pagamento and status == "approved":
                    # Obter horário atual
                    horario = datetime.now().strftime("%H:%M:%S")

                    # Formatado o valor com duas casas decimais
                    valor_formatado = f"{valor:.2f}"

                    # Atualizando variáveis globais
                    status_pagamento = "✅ PIX RECEBIDO"
                    valor_pagamento = f"R$ {valor_formatado}"

                    # Adicionando ao total do dia
                    total_dia += valor

                    # Adicionando ao histórico com horário (mais recente primeiro)
                    historico_pix.insert(0, {
                        "valor": valor_formatado,
                        "hora": horario
                    })

                    # Manter apenas os 10 últimos pagamentos
                    historico_pix = historico_pix[:10]

                    # Atualizar o ID do último pagamento processado
                    ultimo_pagamento = id_pagamento

                    logger.info(f"💰 Novo Pix recebido: R$ {valor_formatado} às {horario}")
                    logger.info(f"💵 Total do dia: R$ {total_dia:.2f}")

            else:
                # Se não há pagamentos, manter o status de aguardando
                if status_pagamento == "✅ PIX RECEBIDO":
                    status_pagamento = "Aguardando pagamento..."

        except requests.exceptions.Timeout:
            logger.warning("⚠️  Timeout ao conectar à API do Mercado Pago")
            status_pagamento = "⚠️  Conexão lenta"

        except requests.exceptions.ConnectionError:
            logger.error("❌ Erro de conexão com a API do Mercado Pago")
            status_pagamento = "❌ Sem conexão"

        except requests.exceptions.HTTPError as e:
            logger.error(f"❌ Erro HTTP: {e.response.status_code}")
            status_pagamento = "❌ Erro na API"

        except Exception as e:
            logger.error(f"❌ Erro inesperado: {str(e)}")
            status_pagamento = "❌ Erro no sistema"

        # Aguardar 3 segundos antes da próxima verificação
        time.sleep(3)


@app.route("/")
def index():
    """
    Rota principal que renderiza o template com os dados atualizados.
    """
    return render_template(
        "index.html",
        status=status_pagamento,
        valor=valor_pagamento if valor_pagamento else "R$ 0,00",
        historico=historico_pix,
        total=f"{total_dia:.2f}"
    )


@app.route("/api/status")
def api_status():
    """
    Rota de API para obter o status atual em JSON (útil para integrações).
    """
    return {
        "status": status_pagamento,
        "valor": valor_pagamento,
        "total_dia": f"R$ {total_dia:.2f}",
        "historico": historico_pix,
        "timestamp": datetime.now().isoformat()
    }


# Iniciar a thread de monitoramento
thread = threading.Thread(target=monitor_pix, daemon=True)
thread.start()


if __name__ == "__main__":
    logger.info("🌐 Iniciando servidor Flask em http://0.0.0.0:5000")
    app.run(host="0.0.0.0", port=5000, debug=False)
