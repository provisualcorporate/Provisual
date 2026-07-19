const fs = require('fs');
let content = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

const regex = /<div className="px-3\.5 py-1 text-\[9px\] font-black text-gray-300 uppercase tracking-widest border-b border-gray-50 mb-1">Partilhar via<\/div>/g;

content = content.replace(regex, (match) => {
  return match + `
                                          
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              const item = typeof folder !== 'undefined' ? { id: folder.id, type: 'folder', currentName: folder.name } : typeof asset !== 'undefined' ? { id: asset.id, type: asset.type, currentName: asset.name } : null;
                                              if (item) {
                                                setItemToDistribute(item);
                                                setDistributeModalOpen(true);
                                                if (typeof setActiveFolderMenuId !== 'undefined') setActiveFolderMenuId(null);
                                                if (typeof setShowMenu !== 'undefined') setShowMenu(false);
                                                if (typeof setActiveFolderSubmenu !== 'undefined') setActiveFolderSubmenu('none');
                                                if (typeof setActiveSubmenu !== 'undefined') setActiveSubmenu('none');
                                              }
                                            }}
                                            className="w-full flex items-center gap-3 px-3.5 py-2 bg-transparent hover:bg-transparent group/sub transition-colors text-left text-[13px] font-bold cursor-pointer"
                                          >
                                            <Share2 size={14} className="text-gray-400 group-hover/sub:text-[#a21b7e] transition-colors shrink-0" />
                                            <span className="text-gray-600 group-hover/sub:text-[#a21b7e] transition-colors">Distribuir a Cliente</span>
                                          </button>`;
});

fs.writeFileSync('src/components/Dashboard.tsx', content);
console.log('Replaced Partilhar via occurrences');
