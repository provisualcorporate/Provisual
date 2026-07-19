const fs = require('fs');
let content = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

const regexBraces = /                                                if \(typeof setActiveSubmenu !== 'undefined'\) setActiveSubmenu\('none'\);\s*\}\s*\}\s*\}\}/g;

content = content.replace(regexBraces, `                                                if (typeof setActiveSubmenu !== 'undefined') setActiveSubmenu('none');
                                              }
                                            }}`);

fs.writeFileSync('src/components/Dashboard.tsx', content);
console.log('Fixed braces');
