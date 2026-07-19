import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBlwlz8tMixpLdaVIxOG1GuJ08F6GjxnKs",
  authDomain: "task-manager-96a33.firebaseapp.com",
  projectId: "task-manager-96a33",
  storageBucket: "task-manager-96a33.firebasestorage.app",
  messagingSenderId: "305896717018",
  appId: "1:305896717018:web:1a51a67e1f914302fb83e3"
};

firebase.initializeApp(firebaseConfig);

export const auth = firebase.auth();
export const db = firebase.firestore();
export { firebase };
