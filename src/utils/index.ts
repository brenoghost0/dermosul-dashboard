export const generateShortId = (length = 8) => {
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const nums = '0123456789';
  const specials = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  // Garantir pelo menos um de cada tipo
  let result = '';
  result += lower.charAt(Math.floor(Math.random() * lower.length));
  result += upper.charAt(Math.floor(Math.random() * upper.length));
  result += nums.charAt(Math.floor(Math.random() * nums.length));
  result += specials.charAt(Math.floor(Math.random() * specials.length));

  // Preencher o restante com caracteres aleatórios de todos os tipos
  const allChars = lower + upper + nums + specials;
  for (let i = 4; i < length; i++) {
    result += allChars.charAt(Math.floor(Math.random() * allChars.length));
  }

  // Embaralhar o resultado para que os primeiros caracteres não sejam sempre os mesmos
  return result.split('').sort(() => 0.5 - Math.random()).join('');
};

export const toISO = (date: Date) => date.toISOString().slice(0, 10);

export const lastNDays = (n: number) => {
  const dates = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(toISO(d));
  }
  return dates.reverse();
};

export const generateUniqueId = () => {
  return Math.random().toString(36).substr(2, 9);
};

export const generateSlug = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/ /g, '-')
    .replace(/[^\w-]+/g, '');
};
