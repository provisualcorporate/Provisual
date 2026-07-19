const fs = require('fs');
let content = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

// AssetCardProps
content = content.replace(
  `  hasSelectionActive?: boolean;
}`,
  `  hasSelectionActive?: boolean;
  onDistribute?: (item: {id: string, type: string, currentName: string}) => void;
}`
);

// AssetCard signature
content = content.replace(
  `  isBulkSelected = false, 
  onToggleBulkSelect,
  hasSelectionActive = false
}: AssetCardProps) {`,
  `  isBulkSelected = false, 
  onToggleBulkSelect,
  hasSelectionActive = false,
  onDistribute
}: AssetCardProps) {`
);

// AssetRow signature
content = content.replace(
  `  hasSelectionActive = false
}: AssetRowProps) {`,
  `  hasSelectionActive = false,
  onDistribute
}: AssetRowProps) {`
);

// Fix the onClick handlers in AssetCard and AssetRow
const regexReplaceButtons = /const item = typeof folder !== 'undefined' \? \{ id: folder\.id, type: 'folder', currentName: folder\.name \} : typeof asset !== 'undefined' \? \{ id: asset\.id, type: asset\.type, currentName: asset\.name \} : null;[\s\S]*?if \(typeof setActiveSubmenu !== 'undefined'\) setActiveSubmenu\('none'\);\s*\}/g;

content = content.replace(regexReplaceButtons, (match) => {
  return `const item = typeof folder !== 'undefined' ? { id: folder.id, type: 'folder', currentName: folder.name } : typeof asset !== 'undefined' ? { id: asset.id, type: asset.type, currentName: asset.name } : null;
                                              if (item) {
                                                if (typeof onDistribute !== 'undefined' && onDistribute) {
                                                  onDistribute(item);
                                                } else if (typeof setItemToDistribute !== 'undefined') {
                                                  setItemToDistribute(item);
                                                  setDistributeModalOpen(true);
                                                }
                                                if (typeof setActiveFolderMenuId !== 'undefined') setActiveFolderMenuId(null);
                                                if (typeof setShowMenu !== 'undefined') setShowMenu(false);
                                                if (typeof setActiveFolderSubmenu !== 'undefined') setActiveFolderSubmenu('none');
                                                if (typeof setActiveSubmenu !== 'undefined') setActiveSubmenu('none');
                                              }
                                            }`;
});

fs.writeFileSync('src/components/Dashboard.tsx', content);
console.log('Fixed props and handlers');
