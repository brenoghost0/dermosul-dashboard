import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, "db.json");

const names = [
  "Maria Oliveira","João Mendes","Ana Paula Santos","Carlos Almeida","Beatriz Ferreira",
  "Rafael Cardoso","Fernanda Lima","Guilherme Rocha","Camila Martins","Bruno Souza"
];
const emails = [
  "maria.oliveira@example.com","joao.mendes@example.com","ana.santos@example.com","c.almeida@example.com",
  "bia.ferreira@example.com","rafa.cardoso@example.com","fernanda.lima@example.com","gui.rocha@example.com",
  "camila.martins@example.com","bruno.souza@example.com"
];
const cpfs = [
  "123.456.789-00","987.654.321-00","111.222.333-44","555.666.777-88","012.345.678-90",
  "222.333.444-55","333.444.555-66","444.555.666-77","555.666.777-00","666.777.888-11"
];
const births = [
  "1990-05-14","1988-11-30","1995-02-20","1992-07-09","1987-03-28",
  "1996-10-05","1993-08-17","1991-12-01","1994-06-22","1989-09-13"
];
const phones = [
  "(11) 98888-0001","(21) 97777-0002","(31) 96666-0003","(41) 95555-0004","(51) 94444-0005",
  "(61) 93333-0006","(62) 92222-0007","(71) 91111-0008","(85) 90000-0009","(48) 98888-0010"
];
const addresses = [
  { address:"Rua das Flores", number:"123", complement:"Apto 101", district:"Centro", city:"São Paulo", state:"SP", zip:"01000-000" },
  { address:"Av. Atlântica", number:"2000", complement:"Bloco B", district:"Copacabana", city:"Rio de Janeiro", state:"RJ", zip:"22000-000" },
  { address:"Rua Goiás", number:"45", complement:"Sala 3", district:"Savassi", city:"Belo Horizonte", state:"MG", zip:"30000-000" },
  { address:"Rua XV de Novembro", number:"900", complement:"Casa", district:"Centro", city:"Curitiba", state:"PR", zip:"80000-000" },
  { address:"Rua da Praia", number:"50", complement:"Fundos", district:"Centro", city:"Porto Alegre", state:"RS", zip:"90000-000" },
  { address:"SQS 308 Bloco A", number:"10", complement:"Apto 10", district:"Asa Sul", city:"Brasília", state:"DF", zip:"70000-000" },
  { address:"Rua 7", number:"222", complement:"Loja", district:"Setor Oeste", city:"Goiânia", state:"GO", zip:"74000-000" },
  { address:"Av. Sete de Setembro", number:"777", complement:"Andar 5", district:"Barra", city:"Salvador", state:"BA", zip:"40000-000" },
  { address:"Rua Beira Mar", number:"12", complement:"Casa 2", district:"Meireles", city:"Fortaleza", state:"CE", zip:"60000-000" },
  { address:"Rua das Acácias", number:"88", complement:"Apto 303", district:"Centro", city:"Florianópolis", state:"SC", zip:"88000-000" }
];

const categories = ["Skincare","Maquiagem","Cabelo","Corpo","Higiene","Solares","Rosto"];

const today = new Date();
const toISO = (d) => d.toISOString().slice(0,10);

function makeOrder(idx) {
  const date = new Date();
  date.setDate(today.getDate() - (30 - idx));
  const order_date = toISO(date);
  const baseId = `${order_date}-${idx}`;

  const items = [
    { sku: "SK-912", name: "Esfoliante Corporal", qty: 2, price: 148.49 },
    { sku: "SK-325", name: "Máscara Facial", qty: 2, price: 32.84 },
    { sku: "SK-709", name: "Sérum Vitamina C", qty: 2, price: 75.17 }
  ];
  const sub = items.reduce((s, it) => s + it.qty * it.price, 0);
  const freight = 19.9;
  const discount = idx % 3 === 0 ? 10 : 0;
  const total = sub - discount + freight;

  return {
    id: baseId,
    order_date,
    status: ["pago","pendente","cancelado","enviado"][idx % 4],
    category: categories[idx % categories.length],
    total_value: Number(total.toFixed(2)),

    customer: {
      id: `cliente_${7000 + idx}`,
      firstName: names[idx].split(' ')[0],
      lastName: names[idx].split(' ').slice(1).join(' '),
      email: emails[idx],
      cpf: cpfs[idx],
      birthdate: births[idx],
      phone: phones[idx],
      zip: addresses[idx].zip,
      address: addresses[idx].address,
      number: addresses[idx].number,
      complement: addresses[idx].complement,
      district: addresses[idx].district,
      city: addresses[idx].city,
      state: addresses[idx].state,
    },

    shipping: {
      method: ["PAC","SEDEX","Motoboy"][idx % 3],
      ...addresses[idx],
      value: freight
    },

    items,
    payments: [{ method: idx % 2 ? "Pix" : "Cartão de Crédito", value: Number(total.toFixed(2)) }],
    summary: { subTotal: Number(sub.toFixed(2)), discount, shipping: freight, total: Number(total.toFixed(2)) }
  };
}

const orders = Array.from({ length: 10 }, (_, i) => makeOrder(i));

function makeVisits() {
  const visits = [];
  for (let i = 0; i < 30; i++) {
    const date = new Date();
    date.setDate(today.getDate() - i);
    visits.push({
      date: toISO(date),
      count: Math.floor(Math.random() * 400) + 100, // 100-499 visits
    });
  }
  return visits;
}

const visits = makeVisits();

fs.writeFileSync(dbPath, JSON.stringify({ orders, visits }, null, 2), "utf-8");
console.log("db.json gerado em", dbPath, "com", orders.length, "pedidos e", visits.length, "dias de visitas.");