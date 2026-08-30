// ============================================================
// FIREBASE IMPORTS
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

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
    onSnapshot,
    query,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";


// ============================================================
// FIREBASE
// ============================================================

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);

const provider = new GoogleAuthProvider();

const $ = (id) => document.getElementById(id);


// ============================================================
// ADMIN EMAILS
// ============================================================

const ADMIN_EMAILS = [
    "028riu@gmail.com",
    "tu0ngtun2gsahur8@gmail.com",
    "linh085760@gmail.com",
    "phuong026443@stu.vinschool.edu.vn"
];


// ============================================================
// DATA
// ============================================================

let subjects = [];

let homeworks = [];

let users = [];

let siteSettings = {};

let started = false;

let unsubscribeSubjects = null;

let unsubscribeHomework = null;

let unsubscribeUsers = null;

let unsubscribeSettings = null;


// ============================================================
// ADMIN CHECK
// ============================================================

function isAdminEmail(email) {

    if (!email) {
        return false;
    }

    return ADMIN_EMAILS.includes(
        email.toLowerCase()
    );

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
// HIDDEN
// ============================================================

function setHidden(id, hidden) {

    const el = $(id);

    if (!el) {
        return;
    }

    el.classList.toggle(
        "hidden",
        hidden
    );

}


// ============================================================
// GOOGLE LOGIN
// ============================================================

const googleLoginBtn = $("googleLoginBtn");

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

const logoutBtn = $("logoutBtn");

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
    (user) => {

        if (!user) {

            setHidden(
                "loginView",
                false
            );

            setHidden(
                "dashboard",
                true
            );

            started = false;

            stopListeners();

            return;

        }


        const email =
            (
                user.email || ""
            ).toLowerCase();


        // ====================================================
        // CHECK ADMIN
        // ====================================================

        if (!isAdminEmail(email)) {

            setHidden(
                "loginView",
                false
            );

            setHidden(
                "dashboard",
                true
            );

            setLoginError(
                `Tài khoản ${
                    user.email || "này"
                } không có quyền quản trị.`
            );

            signOut(auth)
                .catch(
                    (error) =>
                        console.error(
                            "Admin sign-out error:",
                            error
                        )
                );

            return;

        }


        // ====================================================
        // ADMIN OK
        // ====================================================

        setLoginError("");

        setHidden(
            "loginView",
            true
        );

        setHidden(
            "dashboard",
            false
        );


        const adminUser =
            $("adminUser");

        if (adminUser) {

            adminUser.textContent =
                `${user.displayName || "Admin"} · ${user.email}`;

        }


        start();

    }
);


// ============================================================
// STOP LISTENERS
// ============================================================

function stopListeners() {

    if (unsubscribeSubjects) {
        unsubscribeSubjects();
    }

    if (unsubscribeHomework) {
        unsubscribeHomework();
    }

    if (unsubscribeUsers) {
        unsubscribeUsers();
    }

    if (unsubscribeSettings) {
        unsubscribeSettings();
    }


    unsubscribeSubjects = null;

    unsubscribeHomework = null;

    unsubscribeUsers = null;

    unsubscribeSettings = null;

}


// ============================================================
// START
// ============================================================

function start() {

    if (started) {
        return;
    }

    started = true;


    // ========================================================
    // SUBJECTS
    // ========================================================

    const subjectsQuery = query(
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

            (snapshot) => {

                subjects =
                    snapshot.docs.map(
                        (item) => ({
                            id: item.id,
                            ...item.data()
                        })
                    );


                renderSubjects();

                fillSubjectSelect();

                renderHomework();

                updateStats();

            },

            (error) => {

                console.error(
                    "Subjects Firestore error:",
                    error
                );

            }

        );


    // ========================================================
    // HOMEWORK
    // ========================================================

    const homeworkQuery = query(
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

            (snapshot) => {

                homeworks =
                    snapshot.docs.map(
                        (item) => ({
                            id: item.id,
                            ...item.data()
                        })
                    );


                renderHomework();

                updateStats();

            },

            (error) => {

                console.error(
                    "Homework Firestore error:",
                    error
                );

            }

        );


    // ========================================================
    // USERS
    // ========================================================

    const usersQuery =
        collection(
            db,
            "users"
        );


    unsubscribeUsers =
        onSnapshot(

            usersQuery,

            (snapshot) => {

                users =
                    snapshot.docs.map(
                        (item) => ({
                            id: item.id,
                            ...item.data()
                        })
                    );


                renderUsers();

                updateUserStats();

            },

            (error) => {

                console.error(
                    "Users Firestore error:",
                    error
                );

                const container =
                    $("adminUsers");

                if (container) {

                    container.innerHTML =
                        `<p class="error">
                            Không thể tải người dùng:
                            ${esc(error.message)}
                        </p>`;

                }

            }

        );


    // ========================================================
    // SETTINGS
    // ========================================================

    const settingsRef =
        doc(
            db,
            "settings",
            "site"
        );


    unsubscribeSettings =
        onSnapshot(

            settingsRef,

            (snapshot) => {

                if (snapshot.exists()) {

                    siteSettings =
                        snapshot.data();

                } else {

                    siteSettings = {};

                }


                renderSiteSettings();

            },

            (error) => {

                console.error(
                    "Settings Firestore error:",
                    error
                );


                const container =
                    $("adminSettings");

                if (container) {

                    container.innerHTML =
                        `<p class="error">
                            Không thể tải cài đặt:
                            ${esc(error.message)}
                        </p>`;

                }

            }

        );

}


// ============================================================
// RENDER SUBJECTS
// ============================================================

function renderSubjects() {

    const container =
        $("adminTabs");

    if (!container) {
        return;
    }


    if (!subjects.length) {

        container.innerHTML =
            `<p class="muted">
                Chưa có môn học.
            </p>`;

        return;

    }


    container.innerHTML =
        subjects.map(
            (subject) => {

                return `
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
                                onclick="editSubject('${esc(subject.id)}')"
                            >
                                Sửa
                            </button>

                            <button
                                type="button"
                                class="danger"
                                onclick="removeSubject('${esc(subject.id)}')"
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
// RENDER HOMEWORK
// ============================================================

function renderHomework() {

    const container =
        $("adminHomework");

    if (!container) {
        return;
    }


    if (!homeworks.length) {

        container.innerHTML =
            `<p class="muted">
                Chưa có bài tập.
            </p>`;

        return;

    }


    container.innerHTML =
        homeworks.map(
            (homework) => {

                const subject =
                    subjects.find(
                        (item) =>
                            item.id ===
                            homework.subjectId
                    );


                let dueText =
                    "Không đặt hạn";


                if (homework.dueDate) {

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
                                onclick="editHomework('${esc(homework.id)}')"
                            >
                                Sửa
                            </button>

                            <button
                                type="button"
                                class="danger"
                                onclick="removeHomework('${esc(homework.id)}')"
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

    if (!select) {
        return;
    }


    if (!subjects.length) {

        select.innerHTML =
            `<option value="">
                Chưa có môn học
            </option>`;

        return;

    }


    select.innerHTML =
        subjects.map(
            (subject) => {

                return `
                    <option value="${esc(subject.id)}">

                        ${esc(
                            subject.icon ||
                            "📚"
                        )}

                        ${esc(
                            subject.name ||
                            "Môn học"
                        )}

                    </option>
                `;

            }
        ).join("");


    if (
        selectedId &&
        subjects.some(
            (subject) =>
                subject.id ===
                selectedId
        )
    ) {

        select.value =
            selectedId;

    }

}


// ============================================================
// GENERAL STATS
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
            String(
                homeworks.length
            );

    }


    if (statTabs) {

        statTabs.textContent =
            String(
                subjects.length
            );

    }


    if (statPinned) {

        statPinned.textContent =
            String(
                homeworks.filter(
                    (item) =>
                        item.pinned
                ).length
            );

    }

}


// ============================================================
// CREATE HOMEWORK
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


            const form =
                $("homeworkForm");

            if (form) {
                form.reset();
            }


            $("hwDialogTitle").textContent =
                "Tạo bài tập";

            $("hwId").value = "";

            $("hwError").textContent = "";

            fillSubjectSelect();


            $("homeworkDialog")
                .showModal();

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
        async (event) => {

            event.preventDefault();


            const id =
                $("hwId").value.trim();

            const subjectId =
                $("hwTab").value;

            const title =
                $("hwTitle")
                    .value
                    .trim();

            const content =
                $("hwContent")
                    .value
                    .trim();


            if (!subjectId) {

                $("hwError").textContent =
                    "Vui lòng chọn môn học.";

                return;

            }


            if (!title) {

                $("hwError").textContent =
                    "Vui lòng nhập tiêu đề.";

                return;

            }


            if (!content) {

                $("hwError").textContent =
                    "Vui lòng nhập nội dung.";

                return;

            }


            const data = {

                subjectId,

                title,

                content,

                dueDate:
                    $("hwDue").value ||
                    null,

                pinned:
                    $("hwPinned").checked,

                important:
                    $("hwImportant").checked,

                updatedAt:
                    serverTimestamp()

            };


            if (id) {

                const oldHomework =
                    homeworks.find(
                        (item) =>
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
                    .close();

                $("hwError").textContent =
                    "";

            } catch (error) {

                console.error(
                    "Save homework error:",
                    error
                );


                $("hwError").textContent =
                    "Không thể lưu: " +
                    error.message;

            }

        }
    );

}


// ============================================================
// CREATE SUBJECT
// ============================================================

const newTab =
    $("newTab");

if (newTab) {

    newTab.addEventListener(
        "click",
        () => {

            $("tabDialogTitle")
                .textContent =
                "Tạo môn học";


            $("tabForm").reset();

            $("tabId").value =
                "";

            $("tabError").textContent =
                "";


            $("tabDialog")
                .showModal();

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
        async (event) => {

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
                    (subject) =>
                        subject.id === id
                );


            const order =
                id
                    ? (
                        oldSubject?.order ||
                        0
                    )
                    : (
                        subjects.length
                            ? Math.max(
                                ...subjects.map(
                                    (subject) =>
                                        subject.order ||
                                        0
                                )
                            ) + 1
                            : 1
                    );


            const data = {

                name,

                icon,

                order,

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
                    .close();


                $("tabError")
                    .textContent =
                    "";

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
// EDIT HOMEWORK
// ============================================================

window.editHomework =
    (id) => {

        const homework =
            homeworks.find(
                (item) =>
                    item.id === id
            );


        if (!homework) {
            return;
        }


        $("hwDialogTitle")
            .textContent =
            "Sửa bài tập";


        $("hwId").value =
            homework.id;


        fillSubjectSelect(
            homework.subjectId ||
            ""
        );


        $("hwTitle").value =
            homework.title ||
            "";


        $("hwContent").value =
            homework.content ||
            "";


        $("hwDue").value =
            homework.dueDate ||
            "";


        $("hwPinned").checked =
            !!homework.pinned;


        $("hwImportant").checked =
            !!homework.important;


        $("hwError").textContent =
            "";


        $("homeworkDialog")
            .showModal();

    };


// ============================================================
// DELETE HOMEWORK
// ============================================================

window.removeHomework =
    async (id) => {

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

    };


// ============================================================
// EDIT SUBJECT
// ============================================================

window.editSubject =
    (id) => {

        const subject =
            subjects.find(
                (item) =>
                    item.id === id
            );


        if (!subject) {
            return;
        }


        $("tabId").value =
            id;


        $("tabName").value =
            subject.name ||
            "";


        $("tabIcon").value =
            subject.icon ||
            "";


        $("tabDialogTitle")
            .textContent =
            "Sửa môn học";


        $("tabError")
            .textContent =
            "";


        $("tabDialog")
            .showModal();

    };


// ============================================================
// DELETE SUBJECT
// ============================================================

window.removeSubject =
    async (id) => {

        const hasHomework =
            homeworks.some(
                (homework) =>
                    homework.subjectId ===
                    id
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

    };


// ============================================================
// USERS
// ============================================================

function renderUsers() {

    const container =
        $("adminUsers");

    if (!container) {
        return;
    }


    if (!users.length) {

        container.innerHTML =
            `<p class="muted">
                Chưa có người dùng.
            </p>`;

        return;

    }


    container.innerHTML =
        users.map(
            (user) => {

                const email =
                    user.email ||
                    "Không có email";


                const name =
                    user.displayName ||
                    user.name ||
                    email;


                const streak =
                    Number(
                        user.streak ||
                        0
                    );


                const highest =
                    Number(
                        user.highestStreak ||
                        user.maxStreak ||
                        0
                    );


                let lastAccess =
                    "Chưa có";


                if (
                    user.lastAccess
                ) {

                    try {

                        const date =
                            user.lastAccess
                                .toDate
                                ? user.lastAccess.toDate()
                                : new Date(
                                    user.lastAccess
                                );


                        if (
                            !Number.isNaN(
                                date.getTime()
                            )
                        ) {

                            lastAccess =
                                date.toLocaleString(
                                    "vi-VN"
                                );

                        }

                    } catch {

                        lastAccess =
                            "Không xác định";

                    }

                }


                return `
                    <div class="admin-item">

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
                                ${highest}
                            </strong>
                        </small>

                        <small>
                            🕒 Truy cập:
                            ${esc(lastAccess)}
                        </small>

                        <div class="actions">

                            <button
                                type="button"
                                onclick="editUser('${esc(user.id)}')"
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
// USER STATS
// ============================================================

function updateUserStats() {

    const statUsers =
        $("statUsers");

    const statVisited =
        $("statVisitedToday");

    const statStreak =
        $("statTotalStreak");


    if (statUsers) {

        statUsers.textContent =
            String(
                users.length
            );

    }


    const today =
        new Date();


    const todayString =
        today.toLocaleDateString(
            "en-CA"
        );


    const visitedToday =
        users.filter(
            (user) => {

                if (
                    !user.lastAccess
                ) {
                    return false;
                }


                try {

                    const date =
                        user.lastAccess
                            .toDate
                            ? user.lastAccess.toDate()
                            : new Date(
                                user.lastAccess
                            );


                    return (
                        date.toLocaleDateString(
                            "en-CA"
                        ) ===
                        todayString
                    );

                } catch {

                    return false;

                }

            }
        ).length;


    const totalStreak =
        users.reduce(
            (total, user) =>
                total +
                Number(
                    user.streak ||
                    0
                ),
            0
        );


    if (statVisited) {

        statVisited.textContent =
            String(
                visitedToday
            );

    }


    if (statStreak) {

        statStreak.textContent =
            String(
                totalStreak
            );

    }

}


// ============================================================
// EDIT USER
// ============================================================

window.editUser =
    async (id) => {

        const user =
            users.find(
                (item) =>
                    item.id === id
            );


        if (!user) {
            return;
        }


        const name =
            prompt(
                "Tên hiển thị:",
                user.displayName ||
                user.name ||
                ""
            );


        if (name === null) {
            return;
        }


        const streakInput =
            prompt(
                "Streak hiện tại:",
                String(
                    user.streak ||
                    0
                )
            );


        if (
            streakInput === null
        ) {
            return;
        }


        const highestInput =
            prompt(
                "Streak cao nhất:",
                String(
                    user.highestStreak ||
                    user.maxStreak ||
                    0
                )
            );


        if (
            highestInput === null
        ) {
            return;
        }


        const streak =
            Math.max(
                0,
                Number(
                    streakInput
                ) || 0
            );


        const highestStreak =
            Math.max(
                streak,
                Number(
                    highestInput
                ) || 0
            );


        try {

            await setDoc(

                doc(
                    db,
                    "users",
                    id
                ),

                {

                    displayName:
                        name.trim(),

                    streak,

                    highestStreak,

                    updatedAt:
                        serverTimestamp()

                },

                {
                    merge: true
                }

            );


        } catch (error) {

            console.error(
                "Edit user error:",
                error
            );


            alert(
                "Không thể sửa người dùng: " +
                error.message
            );

        }

    };


// ============================================================
// SITE SETTINGS
// ============================================================

function renderSiteSettings() {

    const container =
        $("adminSettings");


    if (!container) {
        return;
    }


    const enabled =
        siteSettings
            .oldHomeworkNoticeEnabled !==
        false;


    container.innerHTML = `

        <div class="admin-item">

            <b>
                🔔 Thông báo bài tập
            </b>

            <label>

                <input
                    type="checkbox"
                    id="oldHomeworkToggle"
                    ${enabled ? "checked" : ""}
                >

                Bật thông báo khi không có bài tập mới

            </label>

            <small>
                Khi bật, người dùng sẽ được thông báo
                rằng hôm nay không có bài tập mới.
            </small>

        </div>

    `;


    const toggle =
        $("oldHomeworkToggle");


    if (toggle) {

        toggle.addEventListener(
            "change",
            async () => {

                await saveSiteSettings({

                    oldHomeworkNoticeEnabled:
                        toggle.checked

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

        const currentUser =
            auth.currentUser;


        // ================================================
        // CHECK LOGIN
        // ================================================

        if (!currentUser) {

            throw new Error(
                "Bạn chưa đăng nhập."
            );

        }


        // ================================================
        // CHECK ADMIN
        // ================================================

        if (
            !isAdminEmail(
                currentUser.email
            )
        ) {

            throw new Error(
                "Tài khoản hiện tại không có quyền Admin."
            );

        }


        // ================================================
        // SAVE
        // ================================================

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
// HTML ESCAPE
// ============================================================

function esc(
    value = ""
) {

    return String(
        value
    ).replace(
        /[&<>"']/g,
        (character) => {

            const entities = {

                "&":
                    "&amp;",

                "<":
                    "&lt;",

                ">":
                    "&gt;",

                '"':
                    "&quot;",

                "'":
                    "&#39;"

            };


            return entities[
                character
            ];

        }
    );

}
