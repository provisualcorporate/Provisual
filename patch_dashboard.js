const fs = require('fs');
let content = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

// Fix sync upsert logic
content = content.replace(
  `        const matchingAssets = assets.filter(a => a.driveId === file.id || (a.name === file.name && a.folderId === folderId));
        const existing = matchingAssets[0];
        const assetData = {
          name: file.name,
          type: fileType,
          captureDate: file.createdTime ? Timestamp.fromDate(new Date(file.createdTime)) : serverTimestamp(),
          uploadDate: serverTimestamp(),
          folderId: file.trashed ? 'trash' : folderId,
          ownerId: "google-drive",
          driveId: file.id,
          thumbnailUrl: file.thumbnailLink || "",
          starred: file.starred || false,
          trashed: file.trashed || false,
          versions: [{
            quality: "original",
            size: fileSize,
            url: file.webViewLink
          }],
          adminToken: "Silva_Chamo_Master_Admin_2026"
        };

        if (!isFolder) {
          if (existing) {
            await updateDoc(doc(db, "assets", existing.id), assetData);
            
            // Limpeza automática de duplicatas residuais antigas
            if (matchingAssets.length > 1) {
              for (let i = 1; i < matchingAssets.length; i++) {
                try {
                  await deleteDoc(doc(db, "assets", matchingAssets[i].id));
                } catch (err) {
                  console.warn("Erro ao limpar duplicado residual:", err);
                }
              }
            }
          } else {
            await addDoc(collection(db, "assets"), assetData);
          }
        }`,
  `        const assetData = {
          name: file.name,
          type: fileType,
          captureDate: file.createdTime ? Timestamp.fromDate(new Date(file.createdTime)) : serverTimestamp(),
          uploadDate: serverTimestamp(),
          folderId: file.trashed ? 'trash' : folderId,
          ownerId: "google-drive",
          driveId: file.id,
          thumbnailUrl: file.thumbnailLink || "",
          starred: file.starred || false,
          trashed: file.trashed || false,
          versions: [{
            quality: "original",
            size: fileSize,
            url: file.webViewLink
          }],
          adminToken: "Silva_Chamo_Master_Admin_2026"
        };

        if (!isFolder) {
          try {
            const { supabase: sb } = await import('../lib/supabase');
            const mapped = {
              name: assetData.name,
              type: assetData.type,
              folder_id: assetData.folderId,
              owner_id: assetData.ownerId,
              drive_id: assetData.driveId,
              thumbnail_url: assetData.thumbnailUrl,
              starred: assetData.starred,
              trashed: assetData.trashed,
              versions: assetData.versions,
              admin_token: assetData.adminToken,
            };
            await sb.from('assets').upsert(mapped, { onConflict: 'drive_id', ignoreDuplicates: false });
          } catch (upsertErr: any) {
            console.warn("[Sync Silencioso] Upsert de asset ignorado:", upsertErr?.message);
          }
        }`
);

// Add state
content = content.replace(
  '  const [isCopiedText, setIsCopiedText] = useState(false);',
  `  const [isCopiedText, setIsCopiedText] = useState(false);
  const [distributeModalOpen, setDistributeModalOpen] = useState(false);
  const [itemToDistribute, setItemToDistribute] = useState<{ id: string, type: 'folder' | 'asset', currentName: string } | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [isDistributing, setIsDistributing] = useState(false);`
);

// Add the modal to the bottom just before the final `</div>\n  );\n}`
const endTarget = `      </AnimatePresence>
    </div>
  );
}`;
const modalUI = `      </AnimatePresence>

      {/* MODAL DISTRIBUIR A CLIENTE */}
      <AnimatePresence>
        {distributeModalOpen && itemToDistribute && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
            onClick={() => setDistributeModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white max-w-md w-full rounded-xl overflow-hidden shadow-2xl flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <div>
                  <h3 className="text-sm font-bold text-gray-800">Distribuir para Cliente</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Defina o cliente a quem este item pertence</p>
                </div>
                <button
                  onClick={() => setDistributeModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-5">
                <div className="flex items-center gap-3 p-3 bg-blue-50/50 border border-blue-100 rounded-lg mb-5">
                  <div className="w-8 h-8 rounded bg-blue-100 flex items-center justify-center text-blue-500">
                    {itemToDistribute.type === 'folder' ? <FolderIcon size={16} /> : <FileText size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-800 truncate">{itemToDistribute.currentName}</p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">{itemToDistribute.type === 'folder' ? 'Pasta' : 'Arquivo'}</p>
                  </div>
                </div>

                <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2">Selecione o Cliente</label>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                  {accounts.filter(a => a.role === 'cliente').map(client => (
                    <button
                      key={client.uid}
                      onClick={() => setSelectedClientId(client.uid)}
                      className={\`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left \${selectedClientId === client.uid ? 'border-[#a21b7e] bg-[#a21b7e]/5 shadow-sm' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'}\`}
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#a21b7e] to-[#d14faa] flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {(client.displayName || client.email)?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-700">{client.displayName || 'Cliente'}</p>
                        <p className="text-xs text-gray-400">{client.email}</p>
                      </div>
                      {selectedClientId === client.uid && <CheckCircle2 size={16} className="text-[#a21b7e] ml-auto shrink-0" />}
                    </button>
                  ))}
                  {accounts.filter(a => a.role === 'cliente').length === 0 && (
                    <div className="p-4 text-center border border-dashed border-gray-200 rounded-xl bg-gray-50 text-gray-500 text-sm">
                      Nenhum cliente cadastrado. Adicione um na aba "Gestão de Clientes".
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                <button
                  onClick={() => setDistributeModalOpen(false)}
                  className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  disabled={!selectedClientId || isDistributing}
                  onClick={async () => {
                    setIsDistributing(true);
                    try {
                      const { supabase: sb } = await import('../lib/supabase');
                      const table = itemToDistribute.type === 'folder' ? 'folders' : 'assets';
                      const { error } = await sb.from(table).update({ client_id: selectedClientId }).eq('id', itemToDistribute.id);
                      if (error) throw error;
                      alert("Distribuído com sucesso!");
                      setDistributeModalOpen(false);
                    } catch (err) {
                      alert("Erro ao distribuir: " + (err.message || String(err)));
                    } finally {
                      setIsDistributing(false);
                    }
                  }}
                  className="px-5 py-2 bg-[#a21b7e] hover:bg-[#8e176d] text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isDistributing ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> A atribuir...</>
                  ) : (
                    <><Share2 size={16} /> Atribuir</>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}`;

if (content.includes(endTarget)) {
  content = content.replace(endTarget, modalUI);
} else {
  console.log("Could not find end of file target!");
}

// Add distribute button to folders grid
content = content.replace(
  `                                          <span className="text-gray-600 group-hover:text-[#a21b7e] transition-colors">Partilhar</span>
                                        </div>
                                        <ChevronRight size={14} className="text-gray-300 group-hover:text-[#a21b7e] transition-colors" />
                                      </button>`,
  `                                          <span className="text-gray-600 group-hover:text-[#a21b7e] transition-colors">Partilhar</span>
                                        </div>
                                        <ChevronRight size={14} className="text-gray-300 group-hover:text-[#a21b7e] transition-colors" />
                                      </button>
                                      
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setItemToDistribute({ id: folder.id, type: 'folder', currentName: folder.name });
                                          setDistributeModalOpen(true);
                                          setActiveFolderMenuId(null);
                                        }}
                                        className="w-full flex items-center justify-between px-3.5 py-2 bg-transparent hover:bg-transparent group transition-colors text-left text-[13px] font-bold cursor-pointer"
                                      >
                                        <div className="flex items-center gap-3">
                                          <Share2 size={15} className="text-gray-400 group-hover:text-[#a21b7e] transition-colors shrink-0" />
                                          <span className="text-gray-600 group-hover:text-[#a21b7e] transition-colors">Distribuir a Cliente</span>
                                        </div>
                                      </button>`
);

// Add distribute button to files grid
content = content.replace(
  `                                      <span className="text-gray-600 group-hover:text-[#a21b7e] transition-colors">Partilhar</span>
                                    </div>
                                    <ChevronRight size={14} className="text-gray-300 group-hover:text-[#a21b7e] transition-colors" />
                                  </button>`,
  `                                      <span className="text-gray-600 group-hover:text-[#a21b7e] transition-colors">Partilhar</span>
                                    </div>
                                    <ChevronRight size={14} className="text-gray-300 group-hover:text-[#a21b7e] transition-colors" />
                                  </button>
                                  
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setItemToDistribute({ id: folder.id, type: 'folder', currentName: folder.name });
                                      setDistributeModalOpen(true);
                                      setActiveFolderMenuId(null);
                                    }}
                                    className="w-full flex items-center justify-between px-3.5 py-2 bg-transparent hover:bg-transparent group transition-colors text-left text-[13px] font-bold cursor-pointer"
                                  >
                                    <div className="flex items-center gap-3">
                                      <Share2 size={15} className="text-gray-400 group-hover:text-[#a21b7e] transition-colors shrink-0" />
                                      <span className="text-gray-600 group-hover:text-[#a21b7e] transition-colors">Distribuir a Cliente</span>
                                    </div>
                                  </button>`
);

fs.writeFileSync('src/components/Dashboard.tsx', content);
console.log('Patched Dashboard.tsx');
