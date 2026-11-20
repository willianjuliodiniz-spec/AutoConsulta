import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Termos de Uso | AutoConsulta',
  description:
    'Termos de Uso da plataforma AutoConsulta (www.autoconsultaveicular.com.br): condições de utilização dos serviços de consulta veicular.',
}

const ULTIMA_ATUALIZACAO = '20 de novembro de 2026'

export default function TermosPage() {
  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-300">
      <header className="border-b border-gray-800">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 flex items-center justify-between">
          <Link href="/" className="text-white font-bold text-lg hover:text-emerald-400 transition-colors">
            AutoConsulta
          </Link>
          <Link href="/" className="text-sm text-gray-400 hover:text-emerald-400 transition-colors">
            ← Voltar ao início
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Termos de Uso</h1>
        <p className="text-sm text-gray-500 mb-10">Última atualização: {ULTIMA_ATUALIZACAO}</p>

        <div className="space-y-8 leading-relaxed text-sm sm:text-base">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Aceitação dos Termos</h2>
            <p>
              Ao acessar ou utilizar o site{' '}
              <span className="text-white">www.autoconsultaveicular.com.br</span> (&quot;AutoConsulta&quot; ou
              &quot;Plataforma&quot;), você declara ter lido, compreendido e aceitado integralmente estes Termos de
              Uso e a nossa{' '}
              <Link href="/privacidade" className="text-emerald-400 hover:underline">
                Política de Privacidade
              </Link>
              . Caso não concorde com alguma condição, não utilize a Plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Descrição do Serviço</h2>
            <p>
              A AutoConsulta é uma plataforma <strong className="text-white">independente</strong> de consulta
              veicular. Ela reúne e apresenta informações sobre veículos a partir de bases de dados públicas e de
              fontes de terceiros, mediante a informação de dados como placa ou chassi. A AutoConsulta não é um órgão
              governamental, não integra o Detran, a Senatran ou qualquer outro órgão público e não possui vínculo
              oficial com eles.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Cadastro e Conta do Usuário</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Para acessar determinados recursos (como a Área do Cliente), pode ser necessário criar uma conta.</li>
              <li>Você deve ser maior de 18 anos ou possuir capacidade civil plena para contratar os serviços.</li>
              <li>
                Você é responsável por fornecer informações verdadeiras, completas e atualizadas, e por manter a
                confidencialidade de suas credenciais de acesso.
              </li>
              <li>Qualquer atividade realizada com a sua conta será de sua responsabilidade.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Uso Permitido</h2>
            <p className="mb-3">Ao utilizar a Plataforma, você se compromete a:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Utilizar as consultas para finalidades legítimas, como avaliar a compra, a venda ou a situação de um veículo;</li>
              <li>Não utilizar as informações para fins ilícitos, discriminatórios, abusivos, de perseguição ou fraude;</li>
              <li>Não realizar consultas automatizadas em massa (scraping, bots) sem autorização expressa;</li>
              <li>Não tentar acessar áreas restritas, comprometer a segurança ou a disponibilidade da Plataforma;</li>
              <li>Respeitar a legislação aplicável, incluindo a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 – LGPD).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Natureza das Informações e Limitação de Responsabilidade</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                As informações exibidas são obtidas de bases de terceiros e podem conter atrasos, inconsistências ou
                omissões. Elas têm caráter meramente informativo e não substituem certidões ou consultas oficiais
                junto aos órgãos competentes.
              </li>
              <li>
                A AutoConsulta não garante que o relatório seja livre de erros nem que reflita a situação do veículo
                em tempo real.
              </li>
              <li>
                A decisão de comprar, vender ou negociar um veículo é de exclusiva responsabilidade do usuário. A
                AutoConsulta não responde por prejuízos decorrentes dessas decisões, nos limites permitidos pela
                legislação.
              </li>
              <li>
                A Plataforma pode ficar temporariamente indisponível por manutenção, falhas de terceiros ou casos
                fortuitos e de força maior.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Preços, Pagamento e Entrega</h2>
            <p>
              Os valores de cada consulta são informados na Plataforma antes da contratação. O relatório é
              disponibilizado em formato digital após a confirmação do pagamento. Os pagamentos são processados por
              provedores de pagamento terceiros, e a AutoConsulta não armazena dados completos de cartão de crédito.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Direito de Arrependimento e Reembolso</h2>
            <p>
              Por se tratar de produto digital de fornecimento imediato, o relatório, uma vez gerado e entregue,
              considera-se integralmente prestado. Nos termos do Código de Defesa do Consumidor (Lei nº 8.078/1990),
              você poderá solicitar o cancelamento e o reembolso nas hipóteses legais, como falha na entrega do
              relatório ou cobrança indevida, entrando em contato pelos nossos canais de atendimento.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Propriedade Intelectual</h2>
            <p>
              A marca, o logotipo, o layout, os textos, o código e demais elementos da Plataforma pertencem à
              AutoConsulta ou a seus licenciantes e são protegidos pela legislação de propriedade intelectual. É
              vedada a reprodução, distribuição ou exploração comercial sem autorização prévia e por escrito.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Proteção de Dados Pessoais</h2>
            <p>
              O tratamento de dados pessoais realizado pela AutoConsulta segue a LGPD e está descrito na{' '}
              <Link href="/privacidade" className="text-emerald-400 hover:underline">
                Política de Privacidade
              </Link>
              , que integra estes Termos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">10. Suspensão e Encerramento</h2>
            <p>
              A AutoConsulta poderá suspender ou encerrar o acesso de usuários que descumprirem estes Termos, sem
              prejuízo de outras medidas legais cabíveis. Você pode solicitar o encerramento da sua conta a qualquer
              momento pelos nossos canais de contato.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">11. Alterações dos Termos</h2>
            <p>
              Estes Termos podem ser atualizados periodicamente. A versão vigente estará sempre disponível nesta
              página, com a data da última atualização. O uso continuado da Plataforma após a publicação das
              alterações indica a sua concordância.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">12. Legislação e Foro</h2>
            <p>
              Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro do domicílio
              do consumidor para dirimir quaisquer controvérsias decorrentes deste instrumento, conforme o Código de
              Defesa do Consumidor.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">13. Contato</h2>
            <p>
              Dúvidas sobre estes Termos podem ser enviadas para{' '}
              <a href="mailto:contato@autoconsultaveicular.com.br" className="text-emerald-400 hover:underline">
                contato@autoconsultaveicular.com.br
              </a>
              .
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-gray-800 py-8 text-center text-xs text-gray-500">
        © 2026 AutoConsulta (www.autoconsultaveicular.com.br). Todos os direitos reservados.
      </footer>
    </div>
  )
}
