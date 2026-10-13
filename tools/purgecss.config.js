// Экстрактор классов для Tailwind: понимает варианты lg:flex, размеры h-[42px], дроби py-2.5
module.exports = {
  defaultExtractor: (content) => content.match(/[^<>"'`\s]*[^<>"'`\s:]/g) || [],
};
