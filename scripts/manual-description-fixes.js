#!/usr/bin/env node
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const updates = {
  cmhp496pt042wvjznpv39p25h: {
    description:
      'Kit corporal da linha Atoderm que limpa com suavidade e recompõe a barreira de hidratação da pele muito seca.',
    descriptionHtml: `<p>O <strong>Kit Corporal Bioderma Atoderm Óleo de Banho + Intensive Baume</strong> trata peles secas, sensíveis ou com tendência à coceira desde o banho. O óleo remove impurezas sem agredir e deposita lipídeos biomiméticos que fortalecem a barreira cutânea, enquanto o creme Intensive Baume garante hidratação calmante por até 24 horas.</p>
<ul>
  <li><strong>Óleo de Banho</strong>: textura sedosa que limpa e protege contra o ressecamento.</li>
  <li><strong>Creme Intensive Baume</strong>: repõe lipídeos essenciais e reduz a sensação de repuxamento.</li>
</ul>
<p><strong>Modo de uso:</strong> aplique o óleo sobre a pele úmida, massageando até formar uma espuma delicada e enxágue. Em seguida, espalhe o creme sobre o corpo seco até completa absorção. Utilize diariamente.</p>`,
  },
  cmhp3w8xk041nvjznznc3c25f: {
    description:
      'Dupla corporal Atoderm para banho e pós-banho que acalma, hidrata e alivia o desconforto de peles secas.',
    descriptionHtml: `<p>O <strong>Kit Corporal Bioderma Atoderm Óleo de Banho + Gel</strong> mantém a pele protegida todos os dias. O óleo limpa com suavidade e reforça a barreira cutânea, enquanto o gel hidratante promove sensação de frescor imediato, reduzindo irritações causadas pelo ressecamento.</p>
<ul>
  <li>Fórmulas com biolipídeos e niacinamida, que fortalecem e acalmam a pele.</li>
  <li>Texturas confortáveis, de rápida absorção e adequadas para toda a família.</li>
</ul>
<p><strong>Como usar:</strong> aplique o óleo durante o banho e enxágue. Com a pele seca, espalhe o gel hidratante nas áreas desejadas, realizando movimentos suaves até completa absorção.</p>`,
  },
  cmhp496zp043gvjzna2b8obz2: {
    name: 'Kit Facial Bioderma Hydrabio - Água Micelar 100 ml e Sérum',
    description:
      'Tratamento facial Hydrabio com água micelar de viagem e sérum concentrado para hidratar e iluminar.',
    descriptionHtml: `<p>O <strong>Kit Facial Bioderma Hydrabio Água Micelar 100 ml + Sérum</strong> combina limpeza inteligente e hidratação intensiva. A água micelar remove maquiagem e impurezas respeitando o equilíbrio natural da pele, enquanto o sérum oferece ação retexturizante com ácido hialurônico e vitamina B3.</p>
<ul>
  <li>Proporciona maciez imediata e luminosidade saudável.</li>
  <li>Indicado para todos os tipos de pele, inclusive as sensíveis.</li>
</ul>
<p><strong>Modo de uso:</strong> aplique a água micelar com um algodão, sem enxaguar. Em seguida, distribua o sérum no rosto limpo, de manhã e/ou à noite.</p>`,
  },
  cmhp3w91d041yvjznajpy8dv6: {
    name: 'Kit Facial Bioderma Hydrabio - Água Micelar 250 ml e Sérum',
    description:
      'Kit Hydrabio com água micelar 250 ml e sérum facial que hidrata profundamente e devolve o viço.',
    descriptionHtml: `<p>O <strong>Kit Facial Bioderma Hydrabio Água Micelar 250 ml + Sérum</strong> foi desenvolvido para devolver a vitalidade da pele desidratada. A água micelar remove maquiagem, poluição e excesso de oleosidade preservando a barreira cutânea; o sérum nutre com ácido hialurônico, niacinamida e patente Aquagenium™, estimulando a produção natural de água.</p>
<p>Com uso contínuo a pele fica suave, luminosa e protegida contra agressões externas.</p>
<p><strong>Como usar:</strong> limpe o rosto com a água micelar e finalize com o sérum, massageando até absorver. Utilize diariamente, manhã e noite.</p>`,
  },
  cmhp3w93a0422vjznu1r9m9gr: {
    description:
      'Tratamento completo Pigmentbio com creme noturno e gel creme FPS 50+ para uniformizar o tom da pele.',
    descriptionHtml: `<p>O <strong>Kit Facial Bioderma Pigmentbio Night Renewer + Gel Creme FPS 50+</strong> atua em múltiplas etapas da hiperpigmentação. À noite, a fórmula com Hexapeptídeo-2 e vitaminas C + E + PP trabalha na reparação celular e aumenta a firmeza. Durante o dia, o Gel Creme combina antioxidantes e filtros UVA/UVB de amplo espectro para evitar novas manchas.</p>
<ul>
  <li>Reduz visivelmente áreas escurecidas em poucas semanas.</li>
  <li>Entrega textura iluminada, hidratada e protegida.</li>
</ul>
<p><strong>Aplicação:</strong> use o creme noturno antes de dormir, sobre a pele limpa. Pela manhã, finalize o ritual com o gel creme FPS 50+, reaplicando a cada 3 horas em exposição solar.</p>`,
  },
  cmhp496ng042svjzn9pzg6fqs: {
    description:
      'Combo facial Mantecorp com protetor solar FPS 60 e dois itens complementares para tratar e proteger.',
    descriptionHtml: `<p>O <strong>Kit Facial Mantecorp FPS 60 + 2 Produtos</strong> oferece proteção solar avançada e cuidados diários para quem deseja pele saudável e uniforme. O protetor proporciona cobertura leve, resistente à água e com ação antioxidante. Os itens complementares potencializam a hidratação e ajudam no controle da oleosidade.</p>
<p><strong>Uso sugerido:</strong> aplique o protetor solar pela manhã e reaplique sempre que houver exposição ao sol. Utilize os demais produtos conforme a necessidade, seguindo a rotina indicada para o seu tipo de pele.</p>`,
  },
  cmhp3w97e042cvjznr7e2d3b8: {
    description:
      'Kit facial Mantecorp com protetor solar FPS 50 e hidratante reparador para uso diário.',
    descriptionHtml: `<p>O <strong>Kit Facial Mantecorp Protetor Solar FPS 50 + Hidratante</strong> foi criado para quem busca proteção e maciez em um único ritual. O filtro FPS 50 defende contra raios UVA/UVB, luz visível e poluição, enquanto o hidratante rico em ativos calmantes mantém o equilíbrio da pele durante todo o dia.</p>
<p><strong>Como usar:</strong> aplique o protetor na pele limpa 15 minutos antes da exposição solar e reaplique a cada 2 horas. Utilize o hidratante diariamente, pela manhã e à noite, para potencializar o efeito.</p>`,
  },
  cmhp3cr0203zgvjznbess41v5: {
    description:
      'Dupla anti-manchas Mantecorp com sabonete líquido e protetor solar FPS 60 para uniformizar a pele.',
    descriptionHtml: `<p>O <strong>Kit Mantecorp Anti-Manchas Facial</strong> reúne o sabonete Blancy TX e o protetor solar tonalizante FPS 60. Juntos, eles ajudam a controlar a produção de melanina, suavizam marcas escurecidas e mantêm a pele protegida contra novas manchas.</p>
<ul>
  <li><strong>Sabonete Blancy TX:</strong> limpa delicadamente e prepara a pele para os tratamentos.</li>
  <li><strong>Protetor Solar FPS 60:</strong> oferece alta cobertura com efeito hidratante e antioxidante.</li>
</ul>
<p><strong>Modo de uso:</strong> lave o rosto com o sabonete duas vezes ao dia. Pela manhã, finalize com o protetor solar, reaplicando sempre que necessário.</p>`,
  },
  cmhp496vl0438vjzny0ty0afb: {
    description:
      'Kit Mantecorp para corpo e rosto com dois protetores FPS 60 que asseguram defesa completa ao ar livre.',
    descriptionHtml: `<p>O <strong>Kit Mantecorp Cuidado da Pele Protetor Corporal FPS 60 + Facial FPS 60</strong> protege intensamente contra os raios UVA/UVB, luz visível e agressões urbanas. A versão corporal oferece cobertura uniforme, resistente à água e ao suor; o protetor facial tem textura leve, não oleosa e acabamento confortável.</p>
<p><strong>Aplicação:</strong> utilize o protetor corporal em toda a pele exposta 15 minutos antes do sol. Aplique o facial na região do rosto e pescoço, reaplicando a cada 2 horas ou após transpiração excessiva.</p>`,
  },
  cmhp496rs0430vjznhv4rusyv: {
    description:
      'Kit Mantecorp com protetor facial FPS 60 e versão tonalizante FPS 30 cor morena para cobertura uniforme.',
    descriptionHtml: `<p>O <strong>Kit Mantecorp Cuidado da Pele Facial FPS 60 + FPS 30 Morena</strong> combina duas texturas para completar a rotina de proteção. O filtro FPS 60 transparente garante defesa diária com toque seco, enquanto a versão FPS 30 com cor morena uniformiza o tom e substitui a base leve.</p>
<p><strong>Como usar:</strong> aplique o FPS 60 todas as manhãs. Utilize o FPS 30 tonalizante após a absorção completa para acrescentar cobertura e reaplique ao longo do dia.</p>`,
  },
  cmhp496jb042ovjzn4d4e85a6: {
    description:
      'Kit facial Mantecorp com protetor FPS 60 incolor e versão em pó FPS 50 cor clara para retoques rápidos.',
    descriptionHtml: `<p>O <strong>Kit Mantecorp Protetor Solar FPS 60 + Pó FPS 50 Clara</strong> mantém o rosto protegido em qualquer situação. O filtro FPS 60 possui textura leve e toque seco; o pó compacto FPS 50, na cor clara, oferece cobertura natural e é perfeito para reaplicar a proteção ao longo do dia.</p>
<p><strong>Modo de uso:</strong> use o protetor líquido pela manhã em todo o rosto. Leve o pó compacto na bolsa e reaplique sobre a pele seca sempre que precisar reforçar o FPS.</p>`,
  },
  cmhp3w9bh042kvjznnj7lrczb: {
    description:
      'Kit Mantecorp com protetor FPS 60 e pó compacto FPS 50 cor clara para pele uniforme e protegida.',
    descriptionHtml: `<p>O <strong>Kit Mantecorp Cuidado da Pele Facial FPS 60 + Pó FPS 50 Clara</strong> alia fotoproteção de amplo espectro e acabamento matte. O protetor em loção cria escudo contra UVA/UVB e luz visível, enquanto o pó compacto reforça o FPS e controla o brilho, ideal para retoques após maquiagem.</p>
<p><strong>Aplicação:</strong> espalhe o protetor líquido sobre rosto e pescoço. Com a pele seca, pressione a esponja do pó compacto e reaplique durante o dia para manter a proteção.</p>`,
  },
  cmhp496xh043cvjznmfvahcjv: {
    description:
      'Kit Mantecorp com protetor FPS 60 e pó FPS 50 cor morena+ para defesa diária com acabamento natural.',
    descriptionHtml: `<p>O <strong>Kit Mantecorp Cuidado da Pele Facial FPS 60 + Pó FPS 50 Morena+</strong> oferece dupla proteção com toque seco. O filtro em loção protege contra radiação e poluição, enquanto o pó compacto tonaliza a pele morena e facilita a reaplicação do FPS.</p>
<p><strong>Como usar:</strong> aplique o protetor líquido antes da exposição solar. Reforce a proteção com o pó compacto ao longo do dia, especialmente após sudorese ou contato com água.</p>`,
  },
  cmhp496tq0434vjzntbu56omp: {
    description:
      'Combo Mantecorp com protetor FPS 60 e pó FPS 50 cor morena+ para pele protegida e maquiada o dia todo.',
    descriptionHtml: `<p>O <strong>Kit Mantecorp Protetor Solar FPS 60 + Pó FPS 50 Morena+</strong> foi pensado para quem busca praticidade. A loção FPS 60 protege intensamente sem pesar e o pó compacto com cor morena+ garante cobertura uniforme, controlando o brilho e permitindo retoques rápidos.</p>
<p><strong>Modo de uso:</strong> aplique a loção sobre a pele limpa e seca. Reaplique com o pó compacto sempre que precisar reforçar o FPS ou retocar a maquiagem.</p>`,
  },
  cmhp3w99d042gvjzn9evi49av: {
    description:
      'Kit Mantecorp com protetor FPS 60 e pó FPS 50 cor extra clara para proteção urbana e acabamento suave.',
    descriptionHtml: `<p>O <strong>Kit Mantecorp Cuidado da Pele Facial FPS 60 + Pó FPS 50 Extra Clara</strong> protege contra raios solares e poluição enquanto uniformiza o tom. O protetor líquido possui textura leve e rápida absorção; o pó compacto extra claro sela a maquiagem e facilita a reaplicação do FPS ao longo do dia.</p>
<p><strong>Aplicação:</strong> distribua o protetor líquido por todo o rosto e pescoço antes do sol. Utilize o pó compacto sobre a pele seca quantas vezes desejar para manter o efeito matte e a proteção.</p>`,
  },
};

async function main() {
  for (const [id, data] of Object.entries(updates)) {
    await prisma.product.update({
      where: { id },
      data,
    });
    console.log(`Atualizado ${id}`);
  }
}

main()
  .catch((error) => {
    console.error('Falha ao atualizar descrições:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
