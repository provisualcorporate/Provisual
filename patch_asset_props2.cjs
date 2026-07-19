const fs = require('fs');
let content = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

// Dashboard.tsx maps over assets
content = content.replace(
  /<AssetCard\s*\n\s*key=\{asset\.id\}\s*\n\s*asset=\{asset\}/g,
  `<AssetCard
                      key={asset.id}
                      asset={asset}
                      onDistribute={(item) => { setItemToDistribute(item); setDistributeModalOpen(true); }}`
);

content = content.replace(
  /<AssetRow\s*\n\s*key=\{asset\.id\}\s*\n\s*asset=\{asset\}/g,
  `<AssetRow
                      key={asset.id}
                      asset={asset}
                      onDistribute={(item) => { setItemToDistribute(item); setDistributeModalOpen(true); }}`
);

// AssetRowProps
content = content.replace(
  `  hasSelectionActive?: boolean;
}`,
  `  hasSelectionActive?: boolean;
  onDistribute?: (item: {id: string, type: string, currentName: string}) => void;
}`
);

fs.writeFileSync('src/components/Dashboard.tsx', content);
console.log('Fixed props and handlers phase 2');
