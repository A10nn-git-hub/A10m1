            // ================== АДМИН ПАНЕЛЬ ==================
            let adminSelectedItems = []; 
            let adminActiveContext = '';

            function openAdminItems(ctx) { 
                adminActiveContext = ctx; 
                adminSelectedItems = []; 
                let g = document.getElementById('admin-items-grid'); 
                g.innerHTML = ''; 
                SHOP_ITEMS.forEach(it => { 
                    if (it.deleted) return;
                    let c = document.createElement('div'); 
                    c.className = 'admin-item-option'; 
                    c.style.cursor = 'pointer'; 
                    let pIcon = it.type === 'name' ? it.plainIcon : getItemVisualHTML(it);
                    c.innerHTML = `
                        <div class="admin-item-thumb">${pIcon}</div>
                        <div class="admin-item-meta">
                            <b>${escapeHTML(it.name)}</b>
                            <span>${escapeHTML(it.rarity || 'UNCOMMON')}</span>
                        </div>
                        <div class="admin-item-price">${parseInt(it.price || 0)} 🪙</div>`; 
                    c.onclick = () => { 
                        if (adminSelectedItems.includes(it.id)) { 
                            adminSelectedItems = adminSelectedItems.filter(i => i !== it.id); 
                            c.classList.remove('equipped'); 
                        } else { 
                            adminSelectedItems.push(it.id); 
                            c.classList.add('equipped'); 
                        } 
                    }; 
                    g.appendChild(c); 
                }); 
                document.getElementById('admin-items-modal').classList.remove('hidden'); 
            }

            function closeAdminItemsModal() { document.getElementById('admin-items-modal').classList.add('hidden'); }

            function confirmAdminItems() { 
                let t = adminSelectedItems.length > 0 ? `Выбрано: ${adminSelectedItems.length}` : ''; 
                if (adminActiveContext === 'give') document.getElementById('give-sel-items').innerText = t; 
                if (adminActiveContext === 'take') document.getElementById('take-sel-items').innerText = t; 
                if (adminActiveContext === 'promo') document.getElementById('promo-sel-items').innerText = t; 
                closeAdminItemsModal(); 
            }

            function renderAdminList() {
                db.ref('admins').once('value').then(s => {
                    let list = document.getElementById('admin-list-display'); 
                    list.innerHTML = '';
                    if(s.exists()) {
                        Object.keys(s.val()).forEach(k => {
                            let btn = (k === myId) ? '' : `<button class="btn btn-red" style="padding:5px;" onclick="removeSingleAdmin('${k}')">X</button>`;
                            list.innerHTML += `<div class="list-item"><b>${k}</b> ${btn}</div>`;
                        });
                    }
                });
            }

            function addAdmin() { 
                let id = document.getElementById('dev-add-admin-id').value; 
                if (!id) return; 
                db.ref('admins/' + id).set(true); 
                setIsland('Добавлен!', '#34c759'); 
                renderAdminList(); 
            }

            function removeSingleAdmin(id) { 
                db.ref('admins/' + id).remove(); 
                setIsland('Удален!', '#34c759'); 
                renderAdminList(); 
            }

            function removeAllAdmins() { 
                db.ref('admins').once('value').then(snap => { 
                    if (snap.exists()) { 
                        let a = snap.val(); 
                        for (let k in a) { 
                            if (k !== myId) db.ref('admins/' + k).remove(); 
                        } 
                        setIsland('Все удалены', '#34c759'); 
                        renderAdminList(); 
                    } 
                }); 
            }

            function giveCoinsDev() { 
                let id = document.getElementById('give-coin-id').value; 
                let a = parseInt(document.getElementById('give-coin-amount').value) || 0; 
                if (!id) return; 
                if (a > 0) {
                    db.ref('users/' + id + '/coins').once('value').then(s => { 
                        db.ref('users/' + id + '/coins').set((s.val() || 0) + a); 
                    }); 
                }
                adminSelectedItems.forEach(it => { 
                    db.ref('users/' + id + '/inventory/' + it).once('value').then(qs => { 
                        let q = parseInt(qs.val()) || 0; 
                        db.ref('users/' + id + '/inventory/' + it).set(q + 1); 
                        db.ref('users/' + id + '/new_items/' + it).set(true);
                    }); 
                }); 
                setIsland('Выдано!', '#34c759'); 
            }

            function takeCoinsDev() { 
                let id = document.getElementById('take-coin-id').value; 
                let a = parseInt(document.getElementById('take-coin-amount').value) || 0; 
                if (!id) return; 
                if (a > 0) {
                    db.ref('users/' + id + '/coins').once('value').then(s => { 
                        db.ref('users/' + id + '/coins').set(Math.max(0, (s.val() || 0) - a)); 
                    }); 
                }
                adminSelectedItems.forEach(it => { 
                    db.ref('users/' + id + '/inventory/' + it).remove(); 
                }); 
                setIsland('Забрано!', '#34c759'); 
            }

            function createPromoDev() { 
                let n = document.getElementById('promo-name').value.toUpperCase(); 
                let a = parseInt(document.getElementById('promo-acts').value); 
                let days = parseInt(document.getElementById('promo-days').value) || 0; 
                let r = parseInt(document.getElementById('promo-reward').value) || 0; 
                if (!n || isNaN(a)) return; 
                let exp = days > 0 ? Date.now() + (days * 86400000) : 0; 
                db.ref('promos/' + n).set({ acts: a, rew: r, items: adminSelectedItems, exp: exp }); 
                setIsland('Промокод создан!', '#34c759'); 
            }

            function redeemPromo() { 
                let c = document.getElementById('promo-input').value.toUpperCase(); 
                if (!c) return; 
                db.ref(`users/${myId}/used_promos/${c}`).once('value').then(us => { 
                    if (us.exists()) return showNegativeAlert("Уже юзал!"); 
                    db.ref(`promos/${c}`).once('value').then(ps => { 
                        if (!ps.exists()) return showNegativeAlert("Нет кода!"); 
                        let d = ps.val(); 
                        if (d.exp > 0 && Date.now() > d.exp) { 
                            db.ref(`promos/${c}`).remove(); 
                            return showNegativeAlert("Срок истек!"); 
                        } 
                        if (d.acts <= 0) { 
                            db.ref(`promos/${c}`).remove(); 
                            return showNegativeAlert("Лимит исчерпан!"); 
                        } 
                        db.ref(`promos/${c}/acts`).set(d.acts - 1); 
                        db.ref(`users/${myId}/used_promos/${c}`).set(true); 
                        if (d.rew > 0) addCoins(d.rew); 
                        if (d.items) {
                            d.items.forEach(it => {
                                db.ref(`users/${myId}/inventory/${it}`).once('value').then(qs => {
                                    db.ref(`users/${myId}/inventory/${it}`).set((parseInt(qs.val()) || 0) + 1);
                                    if (typeof markInventoryItemNew === 'function') markInventoryItemNew(it);
                                });
                            });
                        }
                        setIsland(`Промокод применен!`, '#34c759'); 
                    }); 
                }); 
            }

            function makeCustomItemId(name) {
                const base = String(name || 'item')
                    .trim()
                    .toLowerCase()
                    .replace(/ё/g, 'e')
                    .replace(/[^a-z0-9а-я]+/gi, '_')
                    .replace(/^_+|_+$/g, '') || 'item';
                return `custom_${base}_${Date.now().toString(36)}`;
            }

            function generatedItemIconHTML(name, type, rarity) {
                const text = String(name || '?').trim();
                const letters = text.replace(/[^A-Za-zА-Яа-я0-9]/g, '').slice(0, 2).toUpperCase() || '?';
                const typeClass = ['avatar', 'name', 'medal', 'bg', 'box', 'case'].includes(type) ? type : 'other';
                return `<span class="generated-item-icon generated-item-${typeClass} generated-rarity-${rarity || 'UNCOMMON'}">${escapeHTML(letters)}</span>`;
            }

            function refreshAdminItemControls() {
                const typeEl = document.getElementById('ci-type');
                const customTypeEl = document.getElementById('ci-type-custom');
                if (typeEl && customTypeEl) customTypeEl.style.display = typeEl.value === 'other' ? 'block' : 'none';

                const boxEl = document.getElementById('ci-box');
                if (boxEl) {
                    const boxes = SHOP_ITEMS.filter(i => !i.deleted && i.type === 'box');
                    boxEl.innerHTML = '<option value="no">Не падает из бокса</option>' + boxes.map(i => `<option value="${escapeHTML(i.id)}">${escapeHTML(i.name)}</option>`).join('');
                }

                const deleteEl = document.getElementById('ci-delete-select');
                if (deleteEl) {
                    const items = SHOP_ITEMS.filter(i => !i.deleted);
                    deleteEl.innerHTML = items.length
                        ? items.map(i => `<option value="${escapeHTML(i.id)}">${escapeHTML(i.name)} - ${parseInt(i.price || 0)} монет</option>`).join('')
                        : '<option value="">Магазин пуст</option>';
                }
            }

            function toggleCIBoxInput() {
                refreshAdminItemControls();
            }

            function createCustomItem() {
                let name = document.getElementById('ci-name').value;
                let type = document.getElementById('ci-type').value;
                if(type === 'other') type = document.getElementById('ci-type-custom').value;
                let price = parseInt(document.getElementById('ci-price').value) || 0;
                let rarity = document.getElementById('ci-rarity').value;
                let boxTarget = document.getElementById('ci-box').value || 'no';
                let id = makeCustomItemId(name);
                let icon = generatedItemIconHTML(name, type, rarity);

                if(!name || !type) return showNegativeAlert("Заполните название и тип");

                let itemObj = {
                    id: id,
                    name: name,
                    type: type,
                    price: price,
                    icon: icon,
                    plainIcon: icon,
                    desc: 'Кастомный предмет',
                    rarity: rarity,
                    boxTarget: boxTarget || 'no',
                    generatedIcon: true,
                    deleted: false
                };

                db.ref('custom_items/' + id).set(itemObj);
                setIsland("Предмет добавлен!", "#34c759");
                document.getElementById('ci-name').value = '';
                refreshAdminItemControls();
            }

            async function deleteShopItemDev() {
                const id = document.getElementById('ci-delete-select')?.value;
                if (!id) return;
                const item = SHOP_ITEMS.find(i => i.id === id);
                if (!item) return showNegativeAlert("Предмет не найден.");
                if (!await showCustomConfirm(`Удалить "${item.name}" из магазина навсегда? У владельцев предмет останется.`)) return;

                const updates = {};
                if (item.isCustom) updates[`custom_items/${id}/deleted`] = true;
                else updates[`deleted_shop_items/${id}`] = true;

                db.ref().update(updates).then(() => {
                    setIsland("Предмет удален.", "#34c759");
                    refreshAdminItemControls();
                }).catch(() => {
                    showNegativeAlert(getFirebaseFriendlyMessage("Не удалось удалить предмет."));
                });
            }
