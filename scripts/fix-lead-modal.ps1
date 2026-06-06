$file = "app\(dashboard)\leads\page.tsx"
$lines = Get-Content $file
$before = $lines[0..1463]
$after  = $lines[1678..($lines.Length-1)]

$modal = @'
      {/* Add Lead Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80] flex items-end md:items-center justify-center md:p-4"
            onClick={e => e.target === e.currentTarget && setShowAddModal(false)}>
            <motion.div
              initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="glass-card w-full md:max-w-lg rounded-t-2xl md:rounded-xl max-h-[92dvh] overflow-y-auto">

              <div className="flex items-center justify-between p-5 border-b border-white/10 sticky top-0 z-10" style={{ background: "#060c18" }}>
                <div>
                  <h2 className="text-lg font-bold text-white">Add New Lead</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Client requirement details</p>
                </div>
                <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-white p-1"><X className="w-5 h-5" /></button>
              </div>

              <form onSubmit={handleAddLead} className="p-5 space-y-4">

                {/* Client Info */}
                <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/15">
                  <p className="text-xs font-semibold text-blue-400 mb-3">👤 Client Information</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Full Name *</label>
                      <input required value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} className={inputCls} placeholder="Rajesh Patel" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Phone *</label>
                      <input required value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} className={inputCls} placeholder="9876543210" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="text-xs text-muted-foreground mb-1 block">Email</label>
                    <input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} className={inputCls} placeholder="rajesh@email.com" />
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Source *</label>
                      <select value={form.source} onChange={e => setForm(f => ({...f, source: e.target.value}))} className={inputCls}>
                        <option value="WEBSITE">🌐 CityRealSpace.com</option>
                        <option value="WHATSAPP">💬 WhatsApp</option>
                        <option value="FACEBOOK">📘 Facebook</option>
                        <option value="GOOGLE_BUSINESS">🔍 Google Business</option>
                        <option value="ACRES99">🏠 99acres</option>
                        <option value="MAGICBRICKS">🧱 Magicbricks</option>
                        <option value="HOUSING">🏡 Housing.com</option>
                        <option value="REFERRAL">🤝 Referral</option>
                        <option value="WALK_IN">🚶 Walk-in</option>
                        <option value="COLD_CALL">📞 Cold Call</option>
                        <option value="OTHER">📋 Other</option>
                      </select>
                    </div>
                    {isAdmin && brokers.length > 0 && (
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Assign To</label>
                        <select value={form.assignedToId} onChange={e => setForm(f => ({...f, assignedToId: e.target.value}))} className={inputCls}>
                          <option value="">— Assign Employee —</option>
                          {brokers.map((b: any) => (
                            <option key={b.id} value={b.id}>{b.name} ({b.role?.replace("_"," ")})</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                {/* Property Requirement */}
                <div className="p-3 rounded-xl bg-white/3 border border-white/8">
                  <p className="text-xs font-semibold text-yellow-400 mb-3">🏷️ Property Requirement</p>

                  {/* Category Toggle */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {(["RESIDENTIAL","COMMERCIAL"] as const).map(cat => (
                      <button key={cat} type="button"
                        onClick={() => setForm(f => ({...f, category: cat, propertyType: "", bhk: ""}))}
                        className={`py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                          form.category === cat
                            ? cat === "RESIDENTIAL" ? "bg-blue-500/25 border-blue-500/50 text-blue-300" : "bg-orange-500/25 border-orange-500/50 text-orange-300"
                            : "bg-white/5 border-white/10 text-muted-foreground hover:text-white"
                        }`}>
                        {cat === "RESIDENTIAL" ? "🏠 Residential" : "🏢 Commercial"}
                      </button>
                    ))}
                  </div>

                  {/* Transaction + Property Type */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Transaction *</label>
                      <select value={form.transactionType} onChange={e => setForm(f => ({...f, transactionType: e.target.value, furnishing: ""}))} className={inputCls}>
                        {form.category === "RESIDENTIAL"
                          ? <><option value="BUY">🔑 Buy</option><option value="RENT">🏠 Rent</option><option value="SELL">💰 Sell</option></>
                          : <><option value="BUY">🔑 Buy</option><option value="RENT">🏢 Rent</option><option value="LEASE">📋 Lease</option><option value="SELL">💰 Sell</option></>
                        }
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Property Type</label>
                      <select value={form.propertyType} onChange={e => setForm(f => ({...f, propertyType: e.target.value, bhk: ""}))} className={inputCls}>
                        <option value="">{form.category === "RESIDENTIAL" ? "Flat/Villa/Plot..." : "Office/Shop/Godown..."}</option>
                        {(form.category === "RESIDENTIAL" ? RESIDENTIAL_TYPES : COMMERCIAL_TYPES).map(t => (
                          <option key={t} value={t}>{PROPERTY_LABELS[t]}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* BHK — Apartment only */}
                  {form.category === "RESIDENTIAL" && form.propertyType === "APARTMENT" && (
                    <div className="mb-3">
                      <label className="text-xs text-muted-foreground mb-1.5 block">Configuration (BHK) *</label>
                      <div className="flex flex-wrap gap-2">
                        {["1 BHK","1.5 BHK","2 BHK","2.5 BHK","3 BHK","3.5 BHK","4 BHK","4+ BHK"].map(b => (
                          <button key={b} type="button"
                            onClick={() => setForm(f => ({...f, bhk: f.bhk === b ? "" : b}))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                              form.bhk === b ? "bg-blue-500/30 border-blue-400 text-blue-200 font-bold" : "bg-white/5 border-white/10 text-muted-foreground hover:text-white"
                            }`}>{b}</button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Furnished Status — Rent/Lease only */}
                  {(form.transactionType === "RENT" || form.transactionType === "LEASE") && (
                    <div className="mb-3">
                      <label className="text-xs text-muted-foreground mb-1.5 block">Furnished Status</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[{val:"Fully Furnished",icon:"🛋️"},{val:"Semi Furnished",icon:"🪑"},{val:"Unfurnished",icon:"🏗️"}].map(f => (
                          <button key={f.val} type="button"
                            onClick={() => setForm(prev => ({...prev, furnishing: prev.furnishing === f.val ? "" : f.val}))}
                            className={`py-2 rounded-xl text-xs font-medium border transition-all ${
                              form.furnishing === f.val ? "bg-emerald-500/25 border-emerald-400 text-emerald-200 font-bold" : "bg-white/5 border-white/10 text-muted-foreground hover:text-white"
                            }`}>{f.icon} {f.val}</button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Budget */}
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Budget (₹){(form.transactionType === "RENT" || form.transactionType === "LEASE") ? " / month" : ""}
                    </label>
                    <input type="number" value={form.budget} onChange={e => setForm(f => ({...f, budget: e.target.value}))}
                      className={inputCls}
                      placeholder={form.transactionType === "RENT" ? "e.g. 25000" : form.transactionType === "LEASE" ? "e.g. 80000" : form.category === "RESIDENTIAL" ? "e.g. 7500000" : "e.g. 15000000"} />
                  </div>
                </div>

                {/* Location */}
                <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                  <p className="text-xs font-semibold text-emerald-400 mb-2">📍 Preferred Location — Ahmedabad</p>
                  <select className={inputCls}
                    onChange={e => {
                      const v = e.target.value;
                      if (v && !form.preferredAreas.includes(v)) setForm(f => ({...f, preferredAreas: [...f.preferredAreas, v]}));
                      e.target.value = "";
                    }}>
                    <option value="">+ Select locality...</option>
                    {AHMEDABAD_LOCALITIES.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                  {form.preferredAreas.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {form.preferredAreas.map(a => (
                        <span key={a} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-xs text-emerald-300">
                          📍 {a}
                          <button type="button" onClick={() => setForm(f => ({...f, preferredAreas: f.preferredAreas.filter(x => x !== a)}))}
                            className="text-emerald-500 hover:text-red-400 ml-0.5 font-bold">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Additional Notes */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Additional Requirements</label>
                  <textarea rows={2} value={form.requirements} onChange={e => setForm(f => ({...f, requirements: e.target.value}))}
                    className={`${inputCls} resize-none`}
                    placeholder={form.category === "RESIDENTIAL"
                      ? "e.g. Near school, garden facing, ground floor, gated society..."
                      : "e.g. Ground floor, loading dock, three-phase power, parking..."} />
                </div>

                {/* AI note */}
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-yellow-500/8 border border-yellow-500/20">
                  <Bot className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                  <span className="text-xs text-yellow-300">AI will auto-score, match properties & notify relevant property owners via WhatsApp</span>
                </div>

                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowAddModal(false)}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-muted-foreground hover:text-white transition-all">
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting} className="flex-1 btn-primary text-sm flex items-center justify-center gap-2">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Bot className="w-4 h-4" /> Add Lead + AI Score</>}
                  </button>
                </div>

              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
'@

$newLines = $before + $modal.Split("`n") + $after
$newLines | Set-Content $file -Encoding UTF8
Write-Host "Done: $($newLines.Count) lines"
