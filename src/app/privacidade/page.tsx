import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Política de Privacidade | AutoConsulta',
  description:
    'Política de Privacidade da AutoConsulta (www.autoconsultaveicular.com.br), em conformidade com a Lei Geral de Proteção de Dados (LGPD – Lei nº 13.709/2018).',
}

const ULTIMA_ATUALIZACAO = '20 de novembro de 2026'
const EMAIL_PRIVACIDADE = 'privacidade@autoconsultaveicular.com.br'

export default function PrivacidadePage() {
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
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Política de Privacidade</h1>
        <p className="text-sm text-gray-500 mb-10">Última atualização: {ULTIMA_ATUALIZACAO}</p>

        <div className="space-y-8 leading-relaxed text-sm sm:text-base">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Introdução</h2>
            <p>
              A AutoConsulta (&quot;nós&quot;), responsável pelo site{' '}
              <span className="text-white">www.autoconsultaveicular.com.br</span>, respeita a sua privacidade e se
              compromete a proteger os seus dados pessoais. Esta Política explica, de forma clara, quais dados
              coletamos, para que os utilizamos, com quem os compartilhamos e quais são os seus direitos, em
              conformidade com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 – LGPD), o Marco Civil da
              Internet (Lei nº 12.965/2014) e o Código de Defesa do Consumidor.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Controlador e Encarregado (DPO)</h2>
            <p>
              A AutoConsulta atua como <strong className="text-white">controladora</strong> dos dados pessoais
              tratados nesta Plataforma. Para exercer seus direitos ou tirar dúvidas sobre o tratamento de dados,
              entre em contato com o nosso canal de privacidade/encarregado pelo e-mail{' '}
              <a href={`mailto:${EMAIL_PRIVACIDADE}`} className="text-emerald-400 hover:underline">
                {EMAIL_PRIVACIDADE}
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Dados que Coletamos</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong className="text-white">Dados fornecidos por você:</strong> nome, e-mail, telefone, CPF (quando
                necessário para cadastro ou pagamento) e demais informações informadas ao criar conta ou entrar em
                contato.
              </li>
              <li>
                <strong className="text-white">Dados da consulta:</strong> placa, chassi ou outros identificadores do
                veículo que você informa para gerar o relatório, e o histórico das consultas realizadas.
              </li>
              <li>
                <strong className="text-white">Dados de pagamento:</strong> informações da transação (status, valor,
                meio de pagamento). Os dados completos de cartão são processados diretamente pelo provedor de
                pagamento e não são armazenados por nós.
              </li>
              <li>
                <strong className="text-white">Dados de navegação:</strong> endereço IP, tipo de dispositivo e
                navegador, páginas acessadas, data e hora de acesso e identificadores de cookies.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Finalidades e Bases Legais</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border border-gray-800">
                <thead className="bg-gray-900 text-white">
                  <tr>
                    <th className="p-3 border-b border-gray-800">Finalidade</th>
                    <th className="p-3 border-b border-gray-800">Base legal (LGPD)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-3 border-b border-gray-800">Criar e gerenciar sua conta e acesso à Área do Cliente</td>
                    <td className="p-3 border-b border-gray-800">Execução de contrato (art. 7º, V)</td>
                  </tr>
                  <tr>
                    <td className="p-3 border-b border-gray-800">Realizar a consulta veicular e entregar o relatório</td>
                    <td className="p-3 border-b border-gray-800">Execução de contrato (art. 7º, V)</td>
                  </tr>
                  <tr>
                    <td className="p-3 border-b border-gray-800">Processar pagamentos e prevenir fraudes</td>
                    <td className="p-3 border-b border-gray-800">
                      Execução de contrato e legítimo interesse (art. 7º, V e IX)
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 border-b border-gray-800">Cumprir obrigações legais, fiscais e regulatórias</td>
                    <td className="p-3 border-b border-gray-800">Obrigação legal (art. 7º, II)</td>
                  </tr>
                  <tr>
                    <td className="p-3 border-b border-gray-800">Guardar registros de acesso à aplicação (por 6 meses)</td>
                    <td className="p-3 border-b border-gray-800">Obrigação legal – Marco Civil da Internet, art. 15</td>
                  </tr>
                  <tr>
                    <td className="p-3 border-b border-gray-800">Atendimento, suporte e comunicações sobre o serviço</td>
                    <td className="p-3 border-b border-gray-800">Execução de contrato e legítimo interesse (art. 7º, V e IX)</td>
                  </tr>
                  <tr>
                    <td className="p-3 border-b border-gray-800">Análises de uso, cookies não essenciais e comunicações promocionais</td>
                    <td className="p-3 border-b border-gray-800">Consentimento (art. 7º, I)</td>
                  </tr>
                  <tr>
                    <td className="p-3">Exercício regular de direitos em processos judiciais ou administrativos</td>
                    <td className="p-3">Art. 7º, VI</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Compartilhamento de Dados</h2>
            <p className="mb-3">Não vendemos seus dados pessoais. Podemos compartilhá-los apenas quando necessário com:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provedores de bases de dados veiculares, para viabilizar a consulta solicitada;</li>
              <li>Provedores de pagamento e instituições financeiras, para processar as transações;</li>
              <li>Prestadores de serviços de hospedagem, infraestrutura, e-mail e análise, que atuam como operadores e seguem nossas instruções;</li>
              <li>Autoridades públicas, quando houver obrigação legal ou ordem judicial.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Transferência Internacional</h2>
            <p>
              Alguns de nossos fornecedores podem armazenar dados em servidores localizados fora do Brasil. Nesses
              casos, a transferência observará os requisitos do Capítulo V da LGPD, adotando garantias adequadas de
              proteção.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Prazo de Armazenamento</h2>
            <p>
              Mantemos seus dados pelo tempo necessário para cumprir as finalidades descritas nesta Política, e pelos
              prazos exigidos em lei (por exemplo, obrigações fiscais e registros de acesso). Após esse período, os
              dados são eliminados ou anonimizados, salvo hipóteses de conservação autorizadas pelo art. 16 da LGPD.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Seus Direitos (art. 18 da LGPD)</h2>
            <p className="mb-3">Você pode solicitar, a qualquer momento e mediante requisição:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Confirmação da existência de tratamento e acesso aos seus dados;</li>
              <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
              <li>Anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade;</li>
              <li>Portabilidade dos dados a outro fornecedor, conforme regulamentação da ANPD;</li>
              <li>Eliminação dos dados tratados com base no consentimento;</li>
              <li>Informação sobre com quem compartilhamos seus dados;</li>
              <li>Informação sobre a possibilidade de não fornecer consentimento e suas consequências;</li>
              <li>Revogação do consentimento;</li>
              <li>Oposição a tratamento realizado com fundamento em hipótese diferente do consentimento, em caso de descumprimento da LGPD;</li>
              <li>Revisão de decisões tomadas exclusivamente de forma automatizada que afetem seus interesses.</li>
            </ul>
            <p className="mt-3">
              Para exercer seus direitos, envie uma solicitação para{' '}
              <a href={`mailto:${EMAIL_PRIVACIDADE}`} className="text-emerald-400 hover:underline">
                {EMAIL_PRIVACIDADE}
              </a>
              . Poderemos solicitar informações para confirmar a sua identidade. Você também pode apresentar
              reclamação à Autoridade Nacional de Proteção de Dados (ANPD).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Cookies</h2>
            <p>
              Utilizamos cookies e tecnologias semelhantes para o funcionamento do site (cookies essenciais), para
              lembrar suas preferências e para entender como a Plataforma é utilizada. Cookies não essenciais só serão
              utilizados com o seu consentimento. Você pode gerenciar ou bloquear cookies nas configurações do seu
              navegador, ciente de que isso pode afetar algumas funcionalidades.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">10. Segurança da Informação</h2>
            <p>
              Adotamos medidas técnicas e administrativas razoáveis para proteger os dados pessoais contra acessos não
              autorizados, perda, alteração ou divulgação indevida, como criptografia em trânsito (HTTPS), controle de
              acesso e monitoramento. Nenhum sistema é totalmente imune a riscos; em caso de incidente de segurança que
              possa acarretar risco ou dano relevante, comunicaremos você e a ANPD, conforme o art. 48 da LGPD.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">11. Crianças e Adolescentes</h2>
            <p>
              A Plataforma não se destina a menores de 18 anos, e não coletamos intencionalmente dados de crianças ou
              adolescentes. Caso identifiquemos tal coleta, os dados serão excluídos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">12. Alterações desta Política</h2>
            <p>
              Podemos atualizar esta Política periodicamente. A versão vigente estará sempre disponível nesta página,
              com a data da última atualização. Mudanças relevantes serão comunicadas pelos canais adequados.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">13. Contato</h2>
            <p>
              Em caso de dúvidas, entre em contato pelo e-mail{' '}
              <a href={`mailto:${EMAIL_PRIVACIDADE}`} className="text-emerald-400 hover:underline">
                {EMAIL_PRIVACIDADE}
              </a>
              . Veja também os nossos{' '}
              <Link href="/termos" className="text-emerald-400 hover:underline">
                Termos de Uso
              </Link>
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
