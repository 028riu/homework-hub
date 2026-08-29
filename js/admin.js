import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
    getAuth,
    onAuthStateChanged,
    signInWithPopup,
    GoogleAuthProvider,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    getFirestore,
    collection,
    doc,
    setDoc,
    deleteDoc,
    getDoc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
    firebaseConfig
} from "./firebase-config.js";


// ============================================================
// FIREBASE
// ============================================================

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);

const provider = new GoogleAuthProvider();

const $ = (id) => document.getElementById(id);


// ============================================================
// ADMIN
// ============================================================

const ADMIN_EMAILS = [
    "028riu@gmail.com",

    // THAY EMAIL NÀY BẰNG GMAIL ADMIN THỨ 2
    "tu0ngtun2gsahur8@gmail.com",
    "linh085760@gmail.com",
    "phuong026443@stu.vinschool.edu.vn"
];


// ============================================================
// STATE
// ============================================================

let subjects = [];

let homeworks = [];

let users = [];

let siteSettings = {
    oldHomeworkNoticeEnabled: true,
    noHomeworkNoticeEnabled: true
};

let started = false;

let unsubscribeSubjects = null;

let unsubscribeHomework = null;

let unsubscribeUsers = null;

let unsubscribeSettings = null;


// ============================================================
// HELPERS
// ============================================================

function isAdminEmail(email) {

    if (!email) return false;

    return ADMIN_EMAILS.some(
        admin =>
            admin.toLowerCase() === email.toLowerCase()
    );
}


function esc(value = "") {

    return String(value)
        .replace(
            /[&<>"']/g,
            character => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            })[character]
        );
}


function formatDate(value) {

    if (!value) return "Chưa có";

    try {

        if (
            typeof value === "object" &&
            value.seconds
        ) {

            return new Date(
                value.seconds * 1000
            ).toLocaleString("vi-VN");

        }

        const date = new Date(value);

        if (!Number.isNaN(date.getTime())) {

            return date.toLocaleString("vi-VN");

        }

    } catch (error) {

        console.error(error);

    }

    return String(value);
}


function todayKey() {

    const now = new Date();

    const y = now.getFullYear();

    const m = String(
        now.getMonth() + 1
    ).padStart(2, "0");

    const d = String(
        now.getDate()
    ).padStart(2, "0");

    return `${y}-${m}-${d}`;
}


// ============================================================
// LOGIN ERROR
// ============================================================

function setLoginError(message = "") {

    const el = $("loginError");

    if (el) {

        el.textContent = message;

    }

}


// ============================================================
// VISIBILITY
// ============================================================

function setHidden(id, hidden) {

    const el = $(id);

    if (!el) return;

    el.classList.toggle(
        "hidden",
        hidden
    );

}


// ============================================================
// GOOGLE LOGIN
// ============================================================

const googleLoginBtn =
    $("googleLoginBtn");


if (googleLoginBtn) {

    googleLoginBtn.addEventListener(
        "click",
        async () => {

            setLoginError("");

            googleLoginBtn.disabled = true;

            try {

                await signInWithPopup(
                    auth,
                    provider
                );

            } catch (error) {

                console.error(
                    "Google Login Error:",
                    error
                );

                setLoginError(
                    "Không thể đăng nhập: " +
                    (
                        error.code ||
                        error.message
                    )
                );

            } finally {

                googleLoginBtn.disabled = false;

            }

        }
    );

}


// ============================================================
// LOGOUT
// ============================================================

const logoutBtn =
    $("logoutBtn");


if (logoutBtn) {

    logoutBtn.addEventListener(
        "click",
        async () => {

            try {

                await signOut(auth);

            } catch (error) {

                console.error(
                    "Logout Error:",
                    error
                );

            }

        }
    );

}


// ============================================================
// AUTH STATE
// ============================================================

onAuthStateChanged(
    auth,
    user => {

        const loginView =
            $("loginView");

        const dashboard =
            $("dashboard");


        // ----------------------------------------------------
        // CHƯA ĐĂNG NHẬP
        // ----------------------------------------------------

        if (!user) {

            if (loginView)
                loginView.classList.remove(
                    "hidden"
                );

            if (dashboard)
                dashboard.classList.add(
                    "hidden"
                );

            started = false;

            stopListeners();

            return;
        }


        // ----------------------------------------------------
        // KHÔNG PHẢI ADMIN
        // ----------------------------------------------------

        if (
            !user.email ||
            !isAdminEmail(user.email)
        ) {

            if (loginView)
                loginView.classList.remove(
                    "hidden"
                );

            if (dashboard)
                dashboard.classList.add(
                    "hidden"
                );

            setLoginError(
                `Tài khoản ${
                    user.email || "này"
                } không có quyền quản trị.`
            );

            signOut(auth).catch(
                error =>
                    console.error(
                        "Admin sign-out error:",
                        error
                    )
            );

            return;
        }


        // ----------------------------------------------------
        // ADMIN HỢP LỆ
        // ----------------------------------------------------

        if (loginView)
            loginView.classList.add(
                "hidden"
            );

        if (dashboard)
            dashboard.classList.remove(
                "hidden"
            );


        const adminUser =
            $("adminUser");


        if (adminUser) {

            adminUser.textContent =
                `${
                    user.displayName ||
                    "Admin"
                } · ${user.email}`;

        }


        start();

    }
);


// ============================================================
// STOP LISTENERS
// ============================================================

function stopListeners() {

    if (unsubscribeSubjects)
        unsubscribeSubjects();

    if (unsubscribeHomework)
        unsubscribeHomework();

    if (unsubscribeUsers)
        unsubscribeUsers();

    if (unsubscribeSettings)
        unsubscribeSettings();


    unsubscribeSubjects = null;

    unsubscribeHomework = null;

    unsubscribeUsers = null;

    unsubscribeSettings = null;

}


// ============================================================
// START FIRESTORE
// ============================================================

function start() {

    if (started) return;

    started = true;


    // ========================================================
    // SUBJECTS
    // ========================================================

    const subjectsQuery =
        query(
            collection(
                db,
                "subjects"
            ),
            orderBy(
                "order",
                "asc"
            )
        );


    unsubscribeSubjects =
        onSnapshot(

            subjectsQuery,

            snapshot => {

                subjects =
                    snapshot.docs.map(
                        item => ({
                            id: item.id,
                            ...item.data()
                        })
                    );


                renderSubjects();

                fillSubjectSelect();

                renderHomework();

                updateStats();

            },

            error => {

                console.error(
                    "Subjects error:",
                    error
                );

            }

        );


    // ========================================================
    // HOMEWORK
    // ========================================================

    const homeworkQuery =
        query(
            collection(
                db,
                "homework"
            ),
            orderBy(
                "createdAt",
                "desc"
            )
        );


    unsubscribeHomework =
        onSnapshot(

            homeworkQuery,

            snapshot => {

                homeworks =
                    snapshot.docs.map(
                        item => ({
                            id: item.id,
                            ...item.data()
                        })
                    );


                renderHomework();

                updateStats();

            },

            error => {

                console.error(
                    "Homework error:",
                    error
                );

            }

        );


    // ========================================================
    // USERS
    // ========================================================

    unsubscribeUsers =
        onSnapshot(

            collection(
                db,
                "users"
            ),

            snapshot => {

                users =
                    snapshot.docs.map(
                        item => ({
                            id: item.id,
                            ...item.data()
                        })
                    );


                renderUsers();

                updateStats();

            },

            error => {

                console.error(
                    "Users error:",
                    error
                );

                const container =
                    $("adminUsers");

                if (container) {

                    container.innerHTML =
                        `
                        <p class="error">
                            Không thể tải danh sách người dùng:
                            ${esc(error.message)}
                        </p>
                        `;

                }

            }

        );


    // ========================================================
    // SITE SETTINGS
    // ========================================================

    unsubscribeSettings =
        onSnapshot(

            doc(
                db,
                "settings",
                "site"
            ),

            snapshot => {

                if (snapshot.exists()) {

                    siteSettings = {
                        ...siteSettings,
                        ...snapshot.data()
                    };

                }

                renderSiteSettings();

            },

            error => {

                console.error(
                    "Settings error:",
                    error
                );

            }

        );

}


// ============================================================
// CREATE ADMIN MANAGEMENT UI
// ============================================================

function createManagementUI() {

    const dashboard =
        $("dashboard");

    if (!dashboard) return;

    if (
        document.getElementById(
            "advancedAdminPanel"
        )
    ) {

        return;

    }


    const panel =
        document.createElement(
            "section"
        );


    panel.id =
        "advancedAdminPanel";


    panel.innerHTML = `

        <div class="admin-section">

            <h2>👥 Quản lý người dùng</h2>

            <div class="admin-stats">

                <div class="admin-stat">
                    <b id="userCount">0</b>
                    <span>Người dùng</span>
                </div>

                <div class="admin-stat">
                    <b id="activeTodayCount">0</b>
                    <span>Đã truy cập hôm nay</span>
                </div>

                <div class="admin-stat">
                    <b id="totalStreak">0</b>
                    <span>Tổng streak</span>
                </div>

            </div>

            <div
                id="adminUsers"
                class="admin-list"
            >
                <p class="muted">
                    Đang tải người dùng...
                </p>
            </div>

        </div>


        <div class="admin-section">

            <h2>🔔 Cài đặt thông báo</h2>

            <div
                id="siteSettings"
                class="admin-settings"
            >
                Đang tải...
            </div>

        </div>

    `;


    dashboard.appendChild(panel);

}


// ============================================================
// SETTINGS UI
// ============================================================

function renderSiteSettings() {

    const container =
        $("siteSettings");

    if (!container) return;


    container.innerHTML = `

        <div class="admin-setting-row">

            <div>

                <b>
                    Thông báo bài tập không có cập nhật
                </b>

                <small>
                    Khi sang ngày mới nhưng không có
                    bài tập mới.
                </small>

            </div>

            <label class="switch">

                <input
                    type="checkbox"
                    id="noHomeworkNoticeToggle"
                    ${
                        siteSettings.noHomeworkNoticeEnabled
                            ? "checked"
                            : ""
                    }
                >

                <span></span>

            </label>

        </div>


        <div class="admin-setting-row">

            <div>

                <b>
                    Thông báo bài tập cũ chưa cập nhật
                </b>

                <small>
                    Bật/tắt thông báo riêng cho trường hợp
                    danh sách bài tập vẫn giống ngày trước.
                </small>

            </div>

            <label class="switch">

                <input
                    type="checkbox"
                    id="oldHomeworkNoticeToggle"
                    ${
                        siteSettings.oldHomeworkNoticeEnabled
                            ? "checked"
                            : ""
                    }
                >

                <span></span>

            </label>

        </div>

    `;


    const noHomeworkToggle =
        $("noHomeworkNoticeToggle");


    const oldHomeworkToggle =
        $("oldHomeworkNoticeToggle");


    if (noHomeworkToggle) {

        noHomeworkToggle.addEventListener(
            "change",
            async () => {

                await saveSiteSettings({

                    noHomeworkNoticeEnabled:
                        noHomeworkToggle.checked

                });

            }
        );

    }


    if (oldHomeworkToggle) {

        oldHomeworkToggle.addEventListener(
            "change",
            async () => {

                await saveSiteSettings({

                    oldHomeworkNoticeEnabled:
                        oldHomeworkToggle.checked

                });

            }
        );

    }

}


// ============================================================
// SAVE SITE SETTINGS
// ============================================================

async function saveSiteSettings(
    changes
) {

    try {

        await setDoc(

            doc(
                db,
                "settings",
                "site"
            ),

            {
                ...changes,
                updatedAt:
                    serverTimestamp()
            },

            {
                merge: true
            }

        );

    } catch (error) {

        console.error(
            "Save site settings error:",
            error
        );

        alert(
            "Không thể lưu cài đặt: " +
            error.message
        );

    }

}


// ============================================================
// USERS
// ============================================================

function renderUsers() {

    const container =
        $("adminUsers");

    if (!container) return;


    if (!users.length) {

        container.innerHTML = `

            <p class="muted">
                Chưa có người dùng nào được ghi nhận.
            </p>

        `;

        return;

    }


    const today =
        todayKey();


    const sortedUsers =
        [...users].sort(
            (a, b) => {

                const aDate =
                    a.lastVisitDate ||
                    a.lastLoginDate ||
                    "";

                const bDate =
                    b.lastVisitDate ||
                    b.lastLoginDate ||
                    "";

                return String(bDate)
                    .localeCompare(
                        String(aDate)
                    );

            }
        );


    container.innerHTML =
        sortedUsers.map(
            user => {

                const streak =
                    Number(
                        user.streak ??
                        user.currentStreak ??
                        0
                    );


                const longest =
                    Number(
                        user.longestStreak ??
                        user.maxStreak ??
                        0
                    );


                const lastVisit =
                    user.lastVisitDate ||
                    user.lastLoginDate ||
                    "";


                const onlineToday =
                    lastVisit === today;


                const name =
                    user.displayName ||
                    user.username ||
                    user.name ||
                    "Người dùng";


                const email =
                    user.email ||
                    "Không có email";


                return `

                    <div
                        class="admin-item user-admin-item"
                        data-user-id="${esc(user.id)}"
                    >

                        <div>

                            <b>
                                ${esc(name)}
                            </b>

                            <small>
                                ${esc(email)}
                            </small>

                            <small>

                                🔥 Streak:
                                <strong>
                                    ${streak}
                                </strong>

                                · Cao nhất:
                                <strong>
                                    ${longest}
                                </strong>

                            </small>

                            <small>

                                🕒 Truy cập:
                                ${esc(
                                    formatDate(
                                        user.lastVisitAt ||
                                        user.lastLoginAt ||
                                        lastVisit
                                    )
                                )}

                                ${
                                    onlineToday
                                        ? " · 🟢 Hôm nay"
                                        : ""
                                }

                            </small>

                        </div>


                        <div class="actions">

                            <button
                                type="button"
                                data-user-edit="${esc(user.id)}"
                            >
                                Sửa
                            </button>

                        </div>

                    </div>

                `;

            }
        ).join("");

}


// ============================================================
// USER CLICK
// ============================================================

document.addEventListener(
    "click",
    event => {

        const button =
            event.target.closest(
                "[data-user-edit]"
            );

        if (!button) return;


        const id =
            button.dataset.userEdit;


        openUserEditor(id);

    }
);


// ============================================================
// USER EDITOR
// ============================================================

function openUserEditor(id) {

    const user =
        users.find(
            item => item.id === id
        );

    if (!user) return;


    const oldModal =
        document.getElementById(
            "userEditorModal"
        );


    if (oldModal)
        oldModal.remove();


    const streak =
        Number(
            user.streak ??
            user.currentStreak ??
            0
        );


    const longestStreak =
        Number(
            user.longestStreak ??
            user.maxStreak ??
            0
        );


    const username =
        user.username ||
        "";


    const displayName =
        user.displayName ||
        user.name ||
        "";


    const email =
        user.email ||
        "";


    const modal =
        document.createElement(
            "div"
        );


    modal.id =
        "userEditorModal";


    modal.innerHTML = `

        <div class="admin-modal-backdrop">

            <div class="admin-modal">

                <div class="admin-modal-header">

                    <h2>
                        ✏️ Sửa người dùng
                    </h2>

                    <button
                        type="button"
                        id="closeUserEditor"
                    >
                        ×
                    </button>

                </div>


                <div class="admin-form">

                    <label>

                        UID

                        <input
                            id="editUserUid"
                            value="${esc(user.id)}"
                            readonly
                        >

                    </label>


                    <label>

                        Email

                        <input
                            id="editUserEmail"
                            type="email"
                            value="${esc(email)}"
                        >

                    </label>


                    <label>

                        Tên tài khoản

                        <input
                            id="editUserUsername"
                            value="${esc(username)}"
                        >

                    </label>


                    <label>

                        Tên hiển thị

                        <input
                            id="editUserDisplayName"
                            value="${esc(displayName)}"
                        >

                    </label>


                    <label>

                        🔥 Streak hiện tại

                        <input
                            id="editUserStreak"
                            type="number"
                            min="0"
                            value="${streak}"
                        >

                    </label>


                    <label>

                        🏆 Streak cao nhất

                        <input
                            id="editUserLongestStreak"
                            type="number"
                            min="0"
                            value="${longestStreak}"
                        >

                    </label>


                    <label>

                        📅 Ngày truy cập cuối

                        <input
                            id="editUserLastVisit"
                            value="${esc(
                                user.lastVisitDate ||
                                ""
                            )}"
                            placeholder="YYYY-MM-DD"
                        >

                    </label>


                    <div class="actions">

                        <button
                            type="button"
                            id="saveUserChanges"
                        >
                            💾 Lưu thay đổi
                        </button>

                        <button
                            type="button"
                            class="danger"
                            id="deleteUserProfile"
                        >
                            🗑️ Xóa profile
                        </button>

                    </div>


                    <p
                        id="userEditorError"
                        class="error"
                    ></p>

                </div>

            </div>

        </div>

    `;


    document.body.appendChild(
        modal
    );


    // --------------------------------------------------------
    // CLOSE
    // --------------------------------------------------------

    $("closeUserEditor")
        ?.addEventListener(
            "click",
            () => modal.remove()
        );


    modal
        .querySelector(
            ".admin-modal-backdrop"
        )
        ?.addEventListener(
            "click",
            event => {

                if (
                    event.target.classList.contains(
                        "admin-modal-backdrop"
                    )
                ) {

                    modal.remove();

                }

            }
        );


    // --------------------------------------------------------
    // SAVE
    // --------------------------------------------------------

    $("saveUserChanges")
        ?.addEventListener(
            "click",
            async () => {

                const errorEl =
                    $("userEditorError");


                const newUsername =
                    $("editUserUsername")
                        .value
                        .trim();


                const newDisplayName =
                    $("editUserDisplayName")
                        .value
                        .trim();


                const newEmail =
                    $("editUserEmail")
                        .value
                        .trim();


                const newStreak =
                    Math.max(
                        0,
                        Number(
                            $("editUserStreak")
                                .value
                        ) || 0
                    );


                const newLongest =
                    Math.max(
                        0,
                        Number(
                            $("editUserLongestStreak")
                                .value
                        ) || 0
                    );


                const newLastVisit =
                    $("editUserLastVisit")
                        .value
                        .trim();


                try {

                    await setDoc(

                        doc(
                            db,
                            "users",
                            id
                        ),

                        {

                            username:
                                newUsername,

                            displayName:
                                newDisplayName,

                            email:
                                newEmail,

                            streak:
                                newStreak,

                            currentStreak:
                                newStreak,

                            longestStreak:
                                Math.max(
                                    newLongest,
                                    newStreak
                                ),

                            lastVisitDate:
                                newLastVisit,

                            updatedAt:
                                serverTimestamp()

                        },

                        {
                            merge: true
                        }

                    );


                    modal.remove();


                } catch (error) {

                    console.error(
                        "Save user error:",
                        error
                    );


                    if (errorEl) {

                        errorEl.textContent =
                            "Không thể lưu: " +
                            error.message;

                    }

                }

            }
        );


    // --------------------------------------------------------
    // DELETE
    // --------------------------------------------------------

    $("deleteUserProfile")
        ?.addEventListener(
            "click",
            async () => {

                const confirmed =
                    confirm(
                        "Bạn có chắc muốn xóa profile Firestore của người này?\n\n" +
                        "Tài khoản Google Authentication sẽ KHÔNG bị xóa."
                    );


                if (!confirmed)
                    return;


                try {

                    await deleteDoc(

                        doc(
                            db,
                            "users",
                            id
                        )

                    );


                    modal.remove();


                } catch (error) {

                    console.error(
                        "Delete user error:",
                        error
                    );

                    alert(
                        "Không thể xóa: " +
                        error.message
                    );

                }

            }
        );

}


// ============================================================
// CREATE MANAGEMENT PANEL
// ============================================================

function ensureManagementPanel() {

    setTimeout(
        createManagementUI,
        100
    );

}


// ============================================================
// SUBJECTS
// ============================================================

function renderSubjects() {

    const container =
        $("adminTabs");

    if (!container) return;


    if (!subjects.length) {

        container.innerHTML = `

            <p class="muted">
                Chưa có môn học.
            </p>

        `;

        return;

    }


    container.innerHTML =
        subjects.map(
            subject => `

                <div class="admin-item">

                    <b>
                        ${esc(
                            subject.icon ||
                            "📚"
                        )}

                        ${esc(
                            subject.name ||
                            "Môn học"
                        )}
                    </b>


                    <div class="actions">

                        <button
                            type="button"
                            data-action="edit-subject"
                            data-id="${esc(subject.id)}"
                        >
                            Sửa
                        </button>


                        <button
                            type="button"
                            class="danger"
                            data-action="delete-subject"
                            data-id="${esc(subject.id)}"
                        >
                            Xóa
                        </button>

                    </div>

                </div>

            `
        ).join("");

}


// ============================================================
// HOMEWORK
// ============================================================

function renderHomework() {

    const container =
        $("adminHomework");

    if (!container) return;


    if (!homeworks.length) {

        container.innerHTML = `

            <p class="muted">
                Chưa có bài tập.
            </p>

        `;

        return;

    }


    container.innerHTML =
        homeworks.map(
            homework => {

                const subject =
                    subjects.find(
                        item =>
                            item.id ===
                            homework.subjectId
                    );


                let dueText =
                    "Không đặt hạn";


                if (
                    homework.dueDate
                ) {

                    const due =
                        new Date(
                            homework.dueDate
                        );


                    if (
                        !Number.isNaN(
                            due.getTime()
                        )
                    ) {

                        dueText =
                            due.toLocaleString(
                                "vi-VN"
                            );

                    }

                }


                return `

                    <div class="admin-item">

                        <b>

                            ${
                                homework.pinned
                                    ? "📌 "
                                    : ""
                            }

                            ${
                                homework.important
                                    ? "⭐ "
                                    : ""
                            }

                            ${esc(
                                homework.title ||
                                "Bài tập"
                            )}

                        </b>


                        <small>

                            ${esc(
                                subject?.icon ||
                                "📚"
                            )}

                            ${esc(
                                subject?.name ||
                                "Chưa phân loại"
                            )}

                            ·

                            ${esc(
                                dueText
                            )}

                        </small>


                        <div class="actions">

                            <button
                                type="button"
                                data-action="edit-homework"
                                data-id="${esc(homework.id)}"
                            >
                                Sửa
                            </button>


                            <button
                                type="button"
                                class="danger"
                                data-action="delete-homework"
                                data-id="${esc(homework.id)}"
                            >
                                Xóa
                            </button>

                        </div>

                    </div>

                `;

            }
        ).join("");

}


// ============================================================
// SUBJECT SELECT
// ============================================================

function fillSubjectSelect(
    selectedId = ""
) {

    const select =
        $("hwTab");

    if (!select) return;


    if (!subjects.length) {

        select.innerHTML =
            `
            <option value="">
                Chưa có môn học
            </option>
            `;

        return;

    }


    select.innerHTML =
        subjects.map(
            subject => `

                <option
                    value="${esc(subject.id)}"
                >

                    ${esc(
                        subject.icon ||
                        "📚"
                    )}

                    ${esc(
                        subject.name ||
                        "Môn học"
                    )}

                </option>

            `
        ).join("");


    if (
        selectedId &&
        subjects.some(
            subject =>
                subject.id ===
                selectedId
        )
    ) {

        select.value =
            selectedId;

    }

}


// ============================================================
// STATS
// ============================================================

function updateStats() {

    const statHomework =
        $("statHomework");

    const statTabs =
        $("statTabs");

    const statPinned =
        $("statPinned");


    if (statHomework) {

        statHomework.textContent =
            homeworks.length;

    }


    if (statTabs) {

        statTabs.textContent =
            subjects.length;

    }


    if (statPinned) {

        statPinned.textContent =
            homeworks.filter(
                homework =>
                    homework.pinned
            ).length;

    }


    const userCount =
        $("userCount");

    const activeTodayCount =
        $("activeTodayCount");

    const totalStreak =
        $("totalStreak");


    if (userCount) {

        userCount.textContent =
            users.length;

    }


    const today =
        todayKey();


    if (activeTodayCount) {

        activeTodayCount.textContent =
            users.filter(
                user =>
                    (
                        user.lastVisitDate ||
                        user.lastLoginDate
                    ) === today
            ).length;

    }


    if (totalStreak) {

        totalStreak.textContent =
            users.reduce(
                (
                    total,
                    user
                ) =>
                    total +
                    Number(
                        user.streak ??
                        user.currentStreak ??
                        0
                    ),
                0
            );

    }

}


// ============================================================
// NEW HOMEWORK
// ============================================================

const newHomework =
    $("newHomework");


if (newHomework) {

    newHomework.addEventListener(
        "click",
        () => {

            if (!subjects.length) {

                alert(
                    "Hãy tạo ít nhất 1 môn học trước."
                );

                return;

            }


            $("homeworkForm")
                ?.reset();


            $("hwDialogTitle")
                .textContent =
                "Tạo bài tập";


            $("hwId")
                .value = "";


            $("hwError")
                .textContent = "";


            fillSubjectSelect();


            $("homeworkDialog")
                ?.showModal();

        }
    );

}


// ============================================================
// SAVE HOMEWORK
// ============================================================

const homeworkForm =
    $("homeworkForm");


if (homeworkForm) {

    homeworkForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const id =
                $("hwId")
                    .value
                    .trim();


            const subjectId =
                $("hwTab")
                    .value;


            const title =
                $("hwTitle")
                    .value
                    .trim();


            const content =
                $("hwContent")
                    .value
                    .trim();


            if (!subjectId) {

                $("hwError")
                    .textContent =
                    "Vui lòng chọn môn học.";

                return;

            }


            if (!title) {

                $("hwError")
                    .textContent =
                    "Vui lòng nhập tiêu đề.";

                return;

            }


            if (!content) {

                $("hwError")
                    .textContent =
                    "Vui lòng nhập nội dung.";

                return;

            }


            const data = {

                subjectId,

                title,

                content,

                dueDate:
                    $("hwDue")
                        .value ||
                    null,

                pinned:
                    $("hwPinned")
                        .checked,

                important:
                    $("hwImportant")
                        .checked,

                updatedAt:
                    serverTimestamp()

            };


            if (id) {

                const oldHomework =
                    homeworks.find(
                        item =>
                            item.id === id
                    );


                data.createdAt =
                    oldHomework?.createdAt ||
                    serverTimestamp();

            } else {

                data.createdAt =
                    serverTimestamp();

            }


            try {

                const documentId =
                    id ||
                    crypto.randomUUID();


                await setDoc(

                    doc(
                        db,
                        "homework",
                        documentId
                    ),

                    data

                );


                $("homeworkDialog")
                    ?.close();


                $("hwError")
                    .textContent = "";


            } catch (error) {

                console.error(
                    "Save homework error:",
                    error
                );


                $("hwError")
                    .textContent =
                    "Không thể lưu: " +
                    error.message;

            }

        }
    );

}


// ============================================================
// NEW SUBJECT
// ============================================================

const newTab =
    $("newTab");


if (newTab) {

    newTab.addEventListener(
        "click",
        () => {

            $("tabForm")
                ?.reset();


            $("tabDialogTitle")
                .textContent =
                "Tạo môn học";


            $("tabId")
                .value = "";


            $("tabError")
                .textContent = "";


            $("tabDialog")
                ?.showModal();

        }
    );

}


// ============================================================
// SAVE SUBJECT
// ============================================================

const tabForm =
    $("tabForm");


if (tabForm) {

    tabForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const id =
                $("tabId")
                    .value
                    .trim();


            const name =
                $("tabName")
                    .value
                    .trim();


            const icon =
                $("tabIcon")
                    .value
                    .trim() ||
                "📚";


            if (!name) {

                $("tabError")
                    .textContent =
                    "Vui lòng nhập tên môn học.";

                return;

            }


            const oldSubject =
                subjects.find(
                    item =>
                        item.id === id
                );


            const subjectOrder =
                id

                    ? (
                        oldSubject?.order ||
                        0
                    )

                    : (
                        subjects.length
                            ? Math.max(
                                ...subjects.map(
                                    item =>
                                        item.order ||
                                        0
                                )
                            ) + 1
                            : 1
                    );


            const data = {

                name,

                icon,

                order:
                    subjectOrder,

                updatedAt:
                    serverTimestamp()

            };


            try {

                const documentId =
                    id ||
                    crypto.randomUUID();


                await setDoc(

                    doc(
                        db,
                        "subjects",
                        documentId
                    ),

                    data

                );


                $("tabDialog")
                    ?.close();


                $("tabError")
                    .textContent = "";


            } catch (error) {

                console.error(
                    "Save subject error:",
                    error
                );


                $("tabError")
                    .textContent =
                    "Không thể lưu: " +
                    error.message;

            }

        }
    );

}


// ============================================================
// DYNAMIC ADMIN BUTTONS
// ============================================================

document.addEventListener(
    "click",
    event => {

        const button =
            event.target.closest(
                "button[data-action]"
            );


        if (!button) return;


        const id =
            button.dataset.id;


        const action =
            button.dataset.action;


        if (
            action ===
            "edit-homework"
        ) {

            editHomework(id);

        }


        if (
            action ===
            "delete-homework"
        ) {

            removeHomework(id);

        }


        if (
            action ===
            "edit-subject"
        ) {

            editSubject(id);

        }


        if (
            action ===
            "delete-subject"
        ) {

            removeSubject(id);

        }

    }
);


// ============================================================
// EDIT HOMEWORK
// ============================================================

function editHomework(id) {

    const homework =
        homeworks.find(
            item =>
                item.id === id
        );


    if (!homework) return;


    $("hwDialogTitle")
        .textContent =
        "Sửa bài tập";


    $("hwId")
        .value =
        homework.id;


    fillSubjectSelect(
        homework.subjectId ||
        ""
    );


    $("hwTitle")
        .value =
        homework.title ||
        "";


    $("hwContent")
        .value =
        homework.content ||
        "";


    $("hwDue")
        .value =
        homework.dueDate ||
        "";


    $("hwPinned")
        .checked =
        !!homework.pinned;


    $("hwImportant")
        .checked =
        !!homework.important;


    $("hwError")
        .textContent = "";


    $("homeworkDialog")
        ?.showModal();

}


// ============================================================
// DELETE HOMEWORK
// ============================================================

async function removeHomework(id) {

    if (
        !confirm(
            "Bạn có chắc muốn xóa bài tập này?"
        )
    ) {

        return;

    }


    try {

        await deleteDoc(

            doc(
                db,
                "homework",
                id
            )

        );

    } catch (error) {

        console.error(
            "Delete homework error:",
            error
        );


        alert(
            "Không thể xóa: " +
            error.message
        );

    }

}


// ============================================================
// EDIT SUBJECT
// ============================================================

function editSubject(id) {

    const subject =
        subjects.find(
            item =>
                item.id === id
        );


    if (!subject) return;


    $("tabId")
        .value =
        id;


    $("tabName")
        .value =
        subject.name ||
        "";


    $("tabIcon")
        .value =
        subject.icon ||
        "";


    $("tabDialogTitle")
        .textContent =
        "Sửa môn học";


    $("tabError")
        .textContent = "";


    $("tabDialog")
        ?.showModal();

}


// ============================================================
// DELETE SUBJECT
// ============================================================

async function removeSubject(id) {

    const hasHomework =
        homeworks.some(
            homework =>
                homework.subjectId === id
        );


    if (hasHomework) {

        alert(
            "Môn này đang có bài tập.\n\n" +
            "Hãy chuyển hoặc xóa các bài tập " +
            "thuộc môn này trước."
        );

        return;

    }


    if (
        !confirm(
            "Bạn có chắc muốn xóa môn này?"
        )
    ) {

        return;

    }


    try {

        await deleteDoc(

            doc(
                db,
                "subjects",
                id
            )

        );

    } catch (error) {

        console.error(
            "Delete subject error:",
            error
        );


        alert(
            "Không thể xóa: " +
            error.message
        );

    }

}


// ============================================================
// INIT ADVANCED PANEL
// ============================================================

ensureManagementPanel();
