            // ================== АДМИН ПАНЕЛЬ ==================
            let adminSelectedItems = []; 
            let adminActiveContext = '';

            function openAdminItems(ctx) { 
                adminActiveContext = ctx; 
                adminSelectedItems = []; 
                let g = document.getElementById('admin-items-grid'); 
                g.innerHTML = ''; 
                SHOP_ITEMS.forEach(it => { 
                    let c = document.createElement('div'); 
                    c.className = 'inv-item-card'; 
                    c.style.cursor = 'pointer'; 
                    let pIcon = it.type === 'name' ? it.plainIcon : (it.plainIcon || it.icon);
                    c.innerHTML = `<div class="inv-item-icon">${pIcon}</div><div class="inv-item-name">${it.name}</div>`; 
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
                tg.showAlert('Добавлен!'); 
                renderAdminList(); 
            }

            function removeSingleAdmin(id) { 
                db.ref('admins/' + id).remove(); 
                tg.showAlert('Удален!'); 
                renderAdminList(); 
            }

            function removeAllAdmins() { 
                db.ref('admins').once('value').then(snap => { 
                    if (snap.exists()) { 
                        let a = snap.val(); 
                        for (let k in a) { 
                            if (k !== myId) db.ref('admins/' + k).remove(); 
                        } 
                        tg.showAlert('Все удалены (кроме вас)'); 
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
                    }); 
                }); 
                tg.showAlert('Выдано!'); 
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
                tg.showAlert('Забрано!'); 
            }

            function createPromoDev() { 
                let n = document.getElementById('promo-name').value.toUpperCase(); 
                let a = parseInt(document.getElementById('promo-acts').value); 
                let days = parseInt(document.getElementById('promo-days').value) || 0; 
                let r = parseInt(document.getElementById('promo-reward').value) || 0; 
                if (!n || isNaN(a)) return; 
                let exp = days > 0 ? Date.now() + (days * 86400000) : 0; 
                db.ref('promos/' + n).set({ acts: a, rew: r, items: adminSelectedItems, exp: exp }); 
                tg.showAlert('Промокод создан!'); 
            }

            function redeemPromo() { 
                let c = document.getElementById('promo-input').value.toUpperCase(); 
                if (!c) return; 
                db.ref(`users/${myId}/used_promos/${c}`).once('value').then(us => { 
                    if (us.exists()) return tg.showAlert("Уже юзал!"); 
                    db.ref(`promos/${c}`).once('value').then(ps => { 
                        if (!ps.exists()) return tg.showAlert("Нет кода!"); 
                        let d = ps.val(); 
                        if (d.exp > 0 && Date.now() > d.exp) { 
                            db.ref(`promos/${c}`).remove(); 
                            return tg.showAlert("Срок истек!"); 
                        } 
                        if (d.acts <= 0) { 
                            db.ref(`promos/${c}`).remove(); 
                            return tg.showAlert("Лимит исчерпан!"); 
                        } 
                        db.ref(`promos/${c}/acts`).set(d.acts - 1); 
                        db.ref(`users/${myId}/used_promos/${c}`).set(true); 
                        if (d.rew > 0) addCoins(d.rew); 
                        if (d.items) {
                            d.items.forEach(it => {
                                db.ref(`users/${myId}/inventory/${it}`).once('value').then(qs => {
                                    db.ref(`users/${myId}/inventory/${it}`).set((parseInt(qs.val()) || 0) + 1);
                                });
                            });
                        }
                        tg.showAlert(`Промокод применен!`); 
                    }); 
                }); 
            }

            function toggleCIBoxInput() {
                let s = document.getElementById('ci-type').value;
                document.getElementById('ci-type-custom').style.display = s === 'other' ? 'block' : 'none';
            }

            function createCustomItem() {
                let id = document.getElementById('ci-id').value;
                let name = document.getElementById('ci-name').value;
                let type = document.getElementById('ci-type').value;
                if(type === 'other') type = document.getElementById('ci-type-custom').value;
                let icon = document.getElementById('ci-icon').value;
                let price = parseInt(document.getElementById('ci-price').value) || 0;
                let rarity = document.getElementById('ci-rarity').value;
                let boxTarget = document.getElementById('ci-box').value || null;

                if(!id || !name || !icon) return tg.showAlert("Заполните ID, Имя и Иконку");

                let itemObj = {
                    id: id,
                    name: name,
                    type: type,
                    price: price,
                    icon: icon,
                    plainIcon: icon,
                    desc: 'Кастомный предмет',
                    rarity: rarity,
                    boxTarget: boxTarget || 'no'
                };

                db.ref('custom_items/' + id).set(itemObj);
                tg.showAlert("Предмет добавлен!");
            }
